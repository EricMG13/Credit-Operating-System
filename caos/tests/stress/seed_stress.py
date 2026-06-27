"""Seed the QA DB for render / load stress via the live API (no ORM archaeology).

    BASE_URL=http://127.0.0.1:8010 python seed_stress.py --issuers 200 --runs 5

Bulk issuers (cheap — for Command-Center render tests, S-UI-01); a few real runs
(for the expensive run / report / modules endpoints, S-API-01/03) which execute
server-side via the offline fallback path — clear ANTHROPIC_API_KEY on the QA
server so no tokens are spent. Writes seed_manifest.json with the created ids.

ponytail: API-driven so it needs zero model imports; ceiling ≈ a few hundred
issuers / dozens of runs. For thousands, bulk-INSERT via the ORM instead.
"""
from __future__ import annotations

import argparse
import json
import os
import time

import httpx

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:8010").rstrip("/")


def _wait(c: httpx.Client, run_id: str, timeout: float = 60.0) -> str:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        status = c.get(f"/api/runs/{run_id}").json().get("status")
        if status in ("complete", "failed"):
            return status
        time.sleep(0.25)
    return "timeout"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--issuers", type=int, default=200)
    ap.add_argument("--runs", type=int, default=5)
    args = ap.parse_args()

    issuer_ids: list[str] = []
    runs: list[dict] = []
    with httpx.Client(base_url=BASE, timeout=120.0) as c:
        for i in range(args.issuers):
            r = c.post("/api/issuers/", json={"name": f"StressCo {i:04d}", "ticker": f"STZ{i:04d}"})
            if r.status_code < 300:
                issuer_ids.append(r.json()["id"])
            elif i == 0:
                raise SystemExit(
                    f"issuer create failed {r.status_code}: {r.text[:200]}\n"
                    "Point BASE_URL at the dev/QA server (local-dev identity = no auth); "
                    "if proxied, send X-Forwarded-Email + X-Edge-Authorization.")
        print(f"issuers created: {len(issuer_ids)}")

        for iid in issuer_ids[: args.runs]:
            run_id = c.post("/api/runs", json={"issuer_id": iid}).json()["id"]
            status = _wait(c, run_id)
            runs.append({"id": run_id, "status": status})
            print(f"run {run_id}: {status}")

    out = os.path.join(os.path.dirname(__file__), "seed_manifest.json")
    with open(out, "w") as f:
        json.dump({"base_url": BASE, "issuers": issuer_ids, "runs": runs}, f, indent=2)
    print(f"manifest -> {out}")


if __name__ == "__main__":
    main()
