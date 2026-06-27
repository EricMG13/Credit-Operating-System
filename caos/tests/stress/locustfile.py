"""Locust load + abuse of the expensive CAOS endpoints (STRESS_TEST_PLAN §1).

    pip install -r requirements.txt
    locust -f locustfile.py --host http://127.0.0.1:8010

Self-configures: discovers a run_id from GET /api/runs on start, so seed first
with seed_stress.py. 429s on the NL lane are EXPECTED (20/min limit) — that's the
rate limiter working, counted as success here, not a failure.
"""
from __future__ import annotations

from locust import HttpUser, between, task


class Analyst(HttpUser):
    wait_time = between(0.1, 0.5)
    run_id = None

    def on_start(self) -> None:
        try:
            body = self.client.get("/api/runs?limit=1", name="discover").json()
            row = body[0] if isinstance(body, list) else body.get("items", [{}])[0]
            self.run_id = row.get("id")
        except Exception:
            self.run_id = None

    @task(3)
    def list_runs(self) -> None:
        self.client.get("/api/runs?limit=100", name="GET /runs")

    @task(3)
    def list_issuers(self) -> None:
        self.client.get("/api/issuers/?limit=200", name="GET /issuers")

    @task(2)
    def module_detail(self) -> None:
        if self.run_id:  # N+1: module -> claims -> evidence
            self.client.get(f"/api/runs/{self.run_id}/modules/CP-1", name="GET /runs/{id}/modules/{m}")

    @task(1)
    def report(self) -> None:
        if self.run_id:  # the heavy one: re-assembles every module+claim+evidence to Markdown
            self.client.post(f"/api/runs/{self.run_id}/report", name="POST /runs/{id}/report")

    @task(1)
    def nl_query(self) -> None:  # rate-limited 20/min — expect (and accept) 429s
        with self.client.post("/api/query/nl", json={"question": "what is the leverage"},
                              name="POST /query/nl", catch_response=True) as r:
            if r.status_code == 429:
                r.success()
