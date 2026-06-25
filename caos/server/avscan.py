"""Optional malware scan for uploaded documents (SECURITY.md §4 "Uploads").

A stdlib-only ClamAV ``INSTREAM`` client — no new dependency, no lock-in. The
scanner is **disabled unless ``CLAMAV_HOST`` is set**; when set, every user
upload is streamed to clamd before it is parsed or vaulted, and a signature hit
is rejected (422). Gating mirrors the markitdown / EDGAR optional lanes.

ponytail: a scanner is a *security* control, so a configured scan that cannot
run fails CLOSED (503) rather than silently passing the file — if you turn it
on, it must work. Knobs: point ``CLAMAV_HOST`` at a reachable clamd and size its
``StreamMaxLength`` >= ``MAX_UPLOAD_MB`` (else large files come back inconclusive
→ 503). The deploy stack ships a clamav sidecar under the ``av`` compose profile.
"""

from __future__ import annotations

import asyncio
import logging
import socket
import struct

from fastapi import HTTPException

from config import get_settings

logger = logging.getLogger("caos.avscan")

_FRAME = 1 << 16  # 64 KiB INSTREAM frames
_MAX_REPLY = 4096  # clamd's INSTREAM verdict is a short status line — cap the recv


def _recv_reply(sock: socket.socket) -> bytes:
    """Read clamd's reply (a short, NUL-terminated status line).

    The per-recv socket timeout catches a silent/hung peer, but it resets on every
    byte; a peer that trickles bytes without ever sending the NUL would grow memory
    unbounded. So cap the total: a verdict over ``_MAX_REPLY`` with no terminator is
    a broken peer → raise (the caller maps OSError to a fail-closed 503).
    """
    buf = bytearray()
    while True:
        data = sock.recv(4096)
        if not data:
            break
        buf += data
        if buf.endswith(b"\x00"):
            break
        if len(buf) > _MAX_REPLY:
            raise OSError(f"clamd reply exceeded {_MAX_REPLY} bytes without a terminator")
    return bytes(buf)


def _scan_sync(host: str, port: int, timeout: float, content: bytes) -> None:
    """Stream ``content`` to clamd via INSTREAM. Returns on a clean verdict;
    raises HTTPException on an infected file (422) or an unusable scanner (503)."""
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            sock.sendall(b"zINSTREAM\x00")
            view = memoryview(content)
            for start in range(0, len(content), _FRAME):
                frame = view[start : start + _FRAME]
                sock.sendall(struct.pack("!I", len(frame)))  # 4-byte big-endian length
                sock.sendall(frame)
            sock.sendall(struct.pack("!I", 0))  # zero-length frame = end of stream
            reply = _recv_reply(sock)
    except OSError as exc:  # refused / timed out / dropped mid-scan → fail closed
        logger.error("clamd scan failed (%s) — rejecting upload (fail-closed)", exc)
        raise HTTPException(503, "Malware scanner unavailable — upload rejected.") from exc

    line = reply.decode("utf-8", "replace").strip().rstrip("\x00").strip()
    if line.endswith("FOUND"):
        sig = line.split(":", 1)[-1].strip().removesuffix(" FOUND")
        logger.warning("clamd flagged an upload: %s", sig)
        raise HTTPException(422, f"Upload rejected: malware detected ({sig}).")
    if not line.endswith("OK"):  # e.g. "INSTREAM size limit exceeded. ERROR"
        logger.error("clamd reply not understood (%r) — rejecting (fail-closed)", line)
        raise HTTPException(503, "Malware scan inconclusive — upload rejected.")


async def scan(content: bytes) -> None:
    """Scan an upload when a clamd host is configured; otherwise a no-op.

    Blocking socket I/O runs off-thread so a slow scan never stalls the single
    event loop (same pattern as the CPU-bound parsers in ingest.py).
    """
    s = get_settings()
    if not s.clamav_host:
        return  # scanner not configured → no-op
    await asyncio.to_thread(
        _scan_sync, s.clamav_host, s.clamav_port, float(s.clamav_timeout_s), content
    )
