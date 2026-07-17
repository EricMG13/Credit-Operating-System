#!/usr/bin/env python3
"""Deterministic local clamd protocol emulator for production-like QA.

This is not an antivirus engine and must never be used as deployment evidence.
It accepts ClamAV's INSTREAM framing and returns a clean verdict so an isolated
application lane can exercise the production upload guard without downloading a
signature database or touching an external service.
"""

from __future__ import annotations

import argparse
import socketserver
import struct


class _ClamdHandler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        pending = bytearray()
        while b"\x00" not in pending:
            block = self.request.recv(65_536)
            if not block:
                return
            pending.extend(block)
        command, _, remainder = pending.partition(b"\x00")
        if command != b"zINSTREAM":
            self.request.sendall(b"stream: unsupported command ERROR\x00")
            return
        pending = bytearray(remainder)

        def read_exact(size: int) -> bytes | None:
            while len(pending) < size:
                block = self.request.recv(65_536)
                if not block:
                    return None
                pending.extend(block)
            result = bytes(pending[:size])
            del pending[:size]
            return result

        while True:
            header = read_exact(4)
            if header is None:
                return
            (size,) = struct.unpack("!I", header)
            if size == 0:
                self.request.sendall(b"stream: OK\x00")
                return
            if read_exact(size) is None:
                return


class _ThreadedClamd(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3310)
    args = parser.parse_args()
    with _ThreadedClamd((args.host, args.port), _ClamdHandler) as server:
        host, port = server.server_address
        print(f"fake_clamd: listening={host}:{port}; verdict=clean; production_evidence=false", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
