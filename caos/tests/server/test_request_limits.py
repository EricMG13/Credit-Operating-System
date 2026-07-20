"""Pre-parse request-body boundary tests."""

from __future__ import annotations

import asyncio

import pytest

from request_limits import RequestBodyLimitMiddleware


def _scope(
    *headers: tuple[bytes, bytes],
    scope_type: str = "http",
    raw_path: bytes = b"/api/test",
    query_string: bytes = b"",
) -> dict:
    return {
        "type": scope_type,
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "https",
        "path": raw_path.decode("ascii", "replace"),
        "raw_path": raw_path,
        "query_string": query_string,
        "headers": list(headers),
        "client": ("127.0.0.1", 1234),
        "server": ("test", 443),
    }


def _run(
    *,
    scope: dict,
    chunks: list[bytes],
    json_limit: int = 8,
    default_limit: int = 16,
    target_limit: int = 1_024,
) -> tuple[list[dict], list[bytes]]:
    sent: list[dict] = []
    consumed: list[bytes] = []
    messages = [
        {
            "type": "http.request",
            "body": chunk,
            "more_body": index < len(chunks) - 1,
        }
        for index, chunk in enumerate(chunks)
    ]

    async def receive() -> dict:
        if messages:
            return messages.pop(0)
        return {"type": "http.disconnect"}

    async def send(message: dict) -> None:
        sent.append(message)

    async def downstream(inner_scope, inner_receive, inner_send) -> None:
        if inner_scope["type"] != "http":
            consumed.append(b"non-http")
            return
        while True:
            message = await inner_receive()
            if message["type"] != "http.request":
                break
            consumed.append(message.get("body", b""))
            if not message.get("more_body", False):
                break
        await inner_send({"type": "http.response.start", "status": 204, "headers": []})
        await inner_send({"type": "http.response.body", "body": b""})

    middleware = RequestBodyLimitMiddleware(
        downstream,
        json_limit_bytes=json_limit,
        default_limit_bytes=default_limit,
        target_limit_bytes=target_limit,
    )
    asyncio.run(middleware(scope, receive, send))
    return sent, consumed


@pytest.mark.parametrize(
    "content_type",
    [b"application/json", b"application/json; charset=utf-8", b"application/problem+json"],
)
def test_declared_json_body_over_limit_is_rejected_before_read(content_type):
    sent, consumed = _run(
        scope=_scope((b"content-type", content_type), (b"content-length", b"9")),
        chunks=[b"not-read"],
    )
    assert sent[0]["status"] == 413
    assert consumed == []


def test_chunked_json_body_is_limited_by_actual_bytes():
    sent, consumed = _run(
        scope=_scope((b"content-type", b"application/json")),
        chunks=[b"12345", b"6789"],
    )
    assert sent[0]["status"] == 413
    assert consumed == [b"12345"]


def test_non_json_body_uses_configured_upload_limit():
    sent, consumed = _run(
        scope=_scope((b"content-type", b"multipart/form-data; boundary=x")),
        chunks=[b"123456789"],
    )
    assert sent[0]["status"] == 204
    assert consumed == [b"123456789"]


def test_body_exactly_at_limit_passes():
    sent, consumed = _run(
        scope=_scope((b"content-type", b"application/json")),
        chunks=[b"1234", b"5678"],
    )
    assert sent[0]["status"] == 204
    assert consumed == [b"1234", b"5678"]


def test_non_http_scope_passes_through_unchanged():
    sent, consumed = _run(scope={"type": "lifespan"}, chunks=[])
    assert sent == []
    assert consumed == [b"non-http"]


def test_oversized_request_target_is_rejected_without_reading_body():
    sent, consumed = _run(
        scope=_scope(raw_path=b"/api/test", query_string=b"q=12345678"),
        chunks=[b"not-read"],
        target_limit=16,
    )
    assert sent[0]["status"] == 414
    assert consumed == []


def test_request_target_exactly_at_limit_passes():
    sent, consumed = _run(
        scope=_scope(raw_path=b"/api", query_string=b"q=12"),
        chunks=[b"body"],
        target_limit=8,
    )
    assert sent[0]["status"] == 204
    assert consumed == [b"body"]


@pytest.mark.parametrize(
    "json_limit,default_limit,target_limit",
    [(0, 1, 1), (1, 0, 1), (1, 1, 0)],
)
def test_limits_must_be_positive(json_limit, default_limit, target_limit):
    with pytest.raises(ValueError, match="must be positive"):
        RequestBodyLimitMiddleware(
            lambda *_args: None,
            json_limit_bytes=json_limit,
            default_limit_bytes=default_limit,
            target_limit_bytes=target_limit,
        )
