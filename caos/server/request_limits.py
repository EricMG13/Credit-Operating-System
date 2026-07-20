"""Pre-route ASGI request-target and request-body limits.

FastAPI validates route models only after Starlette has consumed and decoded the
body.  Keep the large document-upload lane available while preventing ordinary
JSON requests from borrowing that entire memory budget.
"""

from __future__ import annotations

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


JSON_BODY_LIMIT_BYTES = 8 * 1024 * 1024
REQUEST_TARGET_LIMIT_BYTES = 16 * 1024


class _RequestBodyTooLarge(Exception):
    """Internal receive-stream sentinel; never exposed as an application error."""


def _is_json_content_type(scope: Scope) -> bool:
    for raw_name, raw_value in scope.get("headers", ()):
        if raw_name.lower() != b"content-type":
            continue
        media_type = raw_value.split(b";", 1)[0].strip().lower()
        return media_type == b"application/json" or media_type.endswith(b"+json")
    return False


def _declared_content_length(scope: Scope) -> int | None:
    values: set[int] = set()
    for raw_name, raw_value in scope.get("headers", ()):
        if raw_name.lower() != b"content-length":
            continue
        try:
            value = int(raw_value)
        except (TypeError, ValueError):
            return None
        if value < 0:
            return None
        values.add(value)
    if len(values) != 1:
        return None
    return values.pop()


def _declared_body_too_large(scope: Scope, limit: int) -> bool:
    declared = _declared_content_length(scope)
    return declared is not None and declared > limit


class RequestBodyLimitMiddleware:
    """Reject oversized HTTP targets/bodies before framework routing/parsing.

    Both the declared length and actual ASGI receive stream are enforced so a
    chunked/HTTP2 request cannot bypass the boundary by omitting Content-Length.
    Non-HTTP scopes pass through unchanged.
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        json_limit_bytes: int = JSON_BODY_LIMIT_BYTES,
        default_limit_bytes: int,
        target_limit_bytes: int = REQUEST_TARGET_LIMIT_BYTES,
    ) -> None:
        if (
            json_limit_bytes < 1
            or default_limit_bytes < 1
            or target_limit_bytes < 1
        ):
            raise ValueError("Request limits must be positive.")
        self.app = app
        self.json_limit_bytes = json_limit_bytes
        self.default_limit_bytes = default_limit_bytes
        self.target_limit_bytes = target_limit_bytes

    def _target_too_large(self, scope: Scope) -> bool:
        return len(scope.get("raw_path", b"")) + len(
            scope.get("query_string", b"")
        ) > self.target_limit_bytes

    def _body_limit(self, scope: Scope) -> int:
        if _is_json_content_type(scope):
            return self.json_limit_bytes
        return self.default_limit_bytes

    def _preflight_rejection(self, scope: Scope, limit: int) -> JSONResponse | None:
        if self._target_too_large(scope):
            return JSONResponse(
                {"detail": "Request target too large."},
                status_code=414,
            )
        if _declared_body_too_large(scope, limit):
            return JSONResponse(
                {"detail": "Request body too large."},
                status_code=413,
            )
        return None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        limit = self._body_limit(scope)
        rejection = self._preflight_rejection(scope, limit)
        if rejection is not None:
            await rejection(scope, receive, send)
            return

        received = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise _RequestBodyTooLarge
            return message

        async def tracked_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracked_send)
        except _RequestBodyTooLarge:
            # Route body parsing occurs before response start. If a future
            # streaming handler reads late, do not corrupt an already-started
            # response; let the server terminate that stream instead.
            if response_started:
                raise
            await self._reject(scope, receive, send)

    @staticmethod
    async def _reject(scope: Scope, receive: Receive, send: Send) -> None:
        response = JSONResponse(
            {"detail": "Request body too large."},
            status_code=413,
        )
        await response(scope, receive, send)
