"""Pre-routing activation gates for rollback-safe optional API surfaces."""

from __future__ import annotations

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from config import get_settings


_WATCH_RULES_PATH = "/api/watch-rules"


def _is_watch_rules_path(path: str) -> bool:
    return path == _WATCH_RULES_PATH or path.startswith(f"{_WATCH_RULES_PATH}/")


class AlertRulesActivationGateMiddleware:
    """Mask the complete watch-rule surface before body parsing or routing."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] == "http"
            and _is_watch_rules_path(scope.get("path", ""))
            and not get_settings().caos_alert_rules_v1_enabled
        ):
            response = JSONResponse({"detail": "Not Found"}, status_code=404)
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)
