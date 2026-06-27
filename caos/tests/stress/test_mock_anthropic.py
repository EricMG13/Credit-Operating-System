"""One runnable check that the mock speaks the SDK wire shape + the fault modes.

Collected by pytest so the mock can't silently rot. Needs only fastapi/starlette
(in the server venv); no live server, no network.
"""
import os

from fastapi.testclient import TestClient

import mock_anthropic as m


def test_ok_returns_message_shape():
    os.environ["MOCK_MODE"] = "ok"
    r = TestClient(m.app).post("/v1/messages", json={"model": "x", "messages": []})
    assert r.status_code == 200
    b = r.json()
    assert b["type"] == "message"
    assert b["content"][0]["type"] == "text"


def test_429_mode_returns_429():
    os.environ["MOCK_MODE"] = "429"
    try:
        r = TestClient(m.app).post("/v1/messages", json={"messages": []})
        assert r.status_code == 429
    finally:
        os.environ["MOCK_MODE"] = "ok"


def test_stream_returns_sse_events():
    os.environ["MOCK_MODE"] = "ok"
    r = TestClient(m.app).post("/v1/messages", json={"messages": [], "stream": True})
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    assert "message_start" in r.text and "message_stop" in r.text
