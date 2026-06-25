"""Upload malware scan (avscan.py) — the optional ClamAV INSTREAM lane.

Exercises the stdlib clamd client against a fake clamd socket server (no real
clamd, no network): a clean verdict passes, a signature hit is rejected (422),
an unconfigured host is a no-op, and a configured-but-unreachable or inconclusive
scanner fails CLOSED (503). The 422/503 split is the whole security contract —
a configured scan that can't run must never silently pass a file.
"""

from __future__ import annotations

import socket
import struct
import threading
import types

import pytest
from fastapi import HTTPException

import avscan

# The EICAR test string — clamd's stand-in for "malware" (harmless by design).
EICAR = (
    rb"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
)


def _drain_instream(conn: socket.socket, sink: bytearray | None = None) -> None:
    """Faithfully consume an INSTREAM upload, exactly as clamd does: read
    ``zINSTREAM\\0``, then a 4-byte big-endian length + that many payload bytes
    per frame, until a zero-length frame. (A substring scan for four NUL bytes
    would end the stream early on binary content that embeds a NUL run, closing
    the socket mid-send and racing the client into a spurious error.) When ``sink``
    is given, every received byte is mirrored into it for raw-wire assertions."""
    pending = bytearray()

    def _recv() -> bytes:
        chunk = conn.recv(4096)
        if chunk and sink is not None:
            sink.extend(chunk)
        return chunk

    while b"\x00" not in pending:  # the command, e.g. b"zINSTREAM\0"
        chunk = _recv()
        if not chunk:
            return
        pending.extend(chunk)
    del pending[: pending.index(b"\x00") + 1]

    def _read(n: int) -> bytes | None:
        while len(pending) < n:
            chunk = _recv()
            if not chunk:
                return None
            pending.extend(chunk)
        out = bytes(pending[:n])
        del pending[:n]
        return out

    while True:
        hdr = _read(4)
        if hdr is None:
            return
        (length,) = struct.unpack("!I", hdr)
        if length == 0:  # zero-length frame = end of stream
            return
        if _read(length) is None:
            return


def _fake_clamd(reply: bytes) -> int:
    """Spin a one-shot clamd that drains an INSTREAM upload then sends ``reply``.
    Returns the bound port; the thread is a daemon so it never blocks teardown."""
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    port = srv.getsockname()[1]

    def serve():
        with srv:
            conn, _ = srv.accept()
            with conn:
                _drain_instream(conn)
                conn.sendall(reply)

    threading.Thread(target=serve, daemon=True).start()
    return port


def _point_at(monkeypatch, host: str, port: int = 3310) -> None:
    """Override avscan's settings without touching the cached real Settings."""
    monkeypatch.setattr(
        avscan,
        "get_settings",
        lambda: types.SimpleNamespace(clamav_host=host, clamav_port=port, clamav_timeout_s=5),
    )


@pytest.mark.asyncio
async def test_clean_upload_passes(monkeypatch):
    port = _fake_clamd(b"stream: OK\x00")
    _point_at(monkeypatch, "127.0.0.1", port)
    await avscan.scan(b"a perfectly ordinary credit agreement")  # no raise == clean


@pytest.mark.asyncio
async def test_infected_upload_rejected_422(monkeypatch):
    port = _fake_clamd(b"stream: Eicar-Test-Signature FOUND\x00")
    _point_at(monkeypatch, "127.0.0.1", port)
    with pytest.raises(HTTPException) as exc:
        await avscan.scan(EICAR)
    assert exc.value.status_code == 422
    assert "Eicar-Test-Signature" in exc.value.detail


@pytest.mark.asyncio
async def test_binary_payload_with_nul_runs_scans_cleanly(monkeypatch):
    # Content that embeds 4-NUL runs and frame-boundary NULs (OLE/PDF/UTF-16) and
    # spans multiple INSTREAM frames — the case the faithful parser must handle.
    port = _fake_clamd(b"stream: OK\x00")
    _point_at(monkeypatch, "127.0.0.1", port)
    payload = b"\x00\x00\x00\x00" + b"%PDF-1.7\x00\x00" + b"\xff" * 100_000
    await avscan.scan(payload)  # no raise == clean, no early-close race


@pytest.mark.asyncio
async def test_unconfigured_host_is_noop(monkeypatch):
    # No host → scan returns immediately without opening any socket.
    _point_at(monkeypatch, "")
    await avscan.scan(EICAR)  # would be flagged if it ran; no-op means no raise


@pytest.mark.asyncio
async def test_unreachable_scanner_fails_closed_503(monkeypatch):
    # Bind a port then close it, so the connect is actively refused.
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    dead_port = s.getsockname()[1]
    s.close()
    _point_at(monkeypatch, "127.0.0.1", dead_port)
    with pytest.raises(HTTPException) as exc:
        await avscan.scan(b"data")
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_inconclusive_reply_fails_closed_503(monkeypatch):
    port = _fake_clamd(b"INSTREAM size limit exceeded. ERROR\x00")
    _point_at(monkeypatch, "127.0.0.1", port)
    with pytest.raises(HTTPException) as exc:
        await avscan.scan(b"x" * 1000)
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_overlong_reply_without_terminator_fails_closed_503(monkeypatch):
    # A peer that streams bytes but never sends the NUL terminator must not grow
    # memory unbounded — the reply cap trips and the scan fails closed.
    port = _fake_clamd(b"x" * 5000)  # exceeds _MAX_REPLY, no terminator
    _point_at(monkeypatch, "127.0.0.1", port)
    with pytest.raises(HTTPException) as exc:
        await avscan.scan(b"data")
    assert exc.value.status_code == 503


def test_scan_sync_frames_the_stream_then_terminates():
    """The wire format clamd requires: a 4-byte length per frame, then a
    zero-length frame. Capture what the client actually sends."""
    raw = bytearray()

    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    port = srv.getsockname()[1]

    def serve():
        with srv:
            conn, _ = srv.accept()
            with conn:
                _drain_instream(conn, raw)  # mirrors the full wire into `raw`
                conn.sendall(b"stream: OK\x00")

    t = threading.Thread(target=serve, daemon=True)
    t.start()
    avscan._scan_sync("127.0.0.1", port, 5.0, b"hello")
    t.join(timeout=2)

    assert bytes(raw).startswith(b"zINSTREAM\x00")
    body = bytes(raw)[len(b"zINSTREAM\x00"):]
    assert body[:4] == struct.pack("!I", 5)        # one 5-byte frame
    assert body[4:9] == b"hello"
    assert body[9:13] == struct.pack("!I", 0)      # zero-length terminator
