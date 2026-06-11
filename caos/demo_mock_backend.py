"""
CAOS DEMO MOCK BACKEND — stdlib only, NO external dependencies.

NOT the real backend (that needs Postgres/Redis/MinIO + an Anthropic key, run via
`docker compose up`). This serves canned data so the Next.js cockpit can be demoed
standalone. Run: python3 demo_mock_backend.py
"""

from __future__ import annotations

import json
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

PORT = 8000
RUN_DURATION_SECONDS = 4.0

ISSUERS = [
    {"id": "11111111-1111-1111-1111-111111111111", "name": "Acme Holdings Corp.",
     "ticker": "ACM", "industry": "Technology", "country": "USA"},
    {"id": "22222222-2222-2222-2222-222222222222", "name": "Meridian Telecom Holdings",
     "ticker": "MRDN", "industry": "Telecom", "country": "UK"},
    {"id": "33333333-3333-3333-3333-333333333333", "name": "Aurora Chemicals SA",
     "ticker": "AURC", "industry": "Specialty Chemicals", "country": "France"},
]

RUNS: dict[str, dict] = {}
LATEST_RUN_BY_ISSUER: dict[str, str] = {}

DOCUMENT = {
    "document_id": "doc-acme-q3",
    "title": "Acme Holdings Corp.",
    "doc_type": "Q3 2023 Earnings Call Transcript",
    "clauses": [
        {"id": "c-open", "speaker": "Operator",
         "text": "Good morning, and welcome to the Acme Holdings Corp. Third Quarter 2023 "
                 "Earnings Conference Call. All participants will be in listen-only mode."},
        {"id": "c-ceo-rev", "speaker": "CEO, Jane Doe",
         "text": "Thank you. Q3 was a pivotal quarter for Acme. Despite macroeconomic headwinds, "
                 "we delivered strong top-line growth. Consolidated revenue increased 14% "
                 "year-over-year to $450 million."},
        {"id": "c-ceo-opex", "speaker": None,
         "text": "However, we want to highlight some specific operational expenses. The integration "
                 "of our recent acquisition of GlobalTech incurred one-time restructuring costs of "
                 "$12.5M. Additionally, non-cash stock-based compensation stood at $8M."},
        {"id": "c-cfo-leverage", "speaker": "CFO, John Smith",
         "text": "Regarding our leverage profile, our total debt stands at $1.2B. With our LTM "
                 "Adjusted EBITDA at $210M after accounting for the $45.2M in add-backs, our net "
                 "leverage ratio is comfortably at 5.7x, well within our covenant limits. Our "
                 "liquidity position remains robust with $150M in cash and a fully undrawn $200M revolver."},
        {"id": "c-cov-capex", "speaker": None,
         "text": "On capital allocation: capex for the quarter ran at $45M against our covenanted "
                 "annual basket of $50M, leaving limited incremental capacity under the basket."},
        {"id": "c-ceo-close", "speaker": None,
         "text": "We are confident in our free cash flow generation for the remainder of the year and "
                 "plan to prioritize deleveraging over the next 12-18 months."},
    ],
}

CONCLUSIONS = {
    "cp2.thesis": {
        "id": "cp2.thesis", "module": "CP-2", "label": "Calculated Net Leverage", "value": "5.7x",
        "evidence_chain": [{
            "evidence": "total debt stands at $1.2B. With our LTM Adjusted EBITDA at $210M after "
                        "accounting for the $45.2M in add-backs ... net leverage ratio is ... 5.7x",
            "source_doc": "Q3 Earnings Call Transcript", "confidence": 0.9,
            "risk_mechanic": "Add-back-inflated EBITDA understates true leverage; ex add-backs "
                             "leverage is closer to 6.0x.",
            "credit_implication": "Headline covenant headroom overstates true cushion against a "
                                  "downside EBITDA scenario.",
            "anchor": {"document_id": "doc-acme-q3", "clause_id": "c-cfo-leverage",
                       "quote": "net leverage ratio is comfortably at 5.7x"},
        }],
    },
    "cp3.subject": {
        "id": "cp3.subject", "module": "CP-3", "label": "Subject Spread vs Cohort", "value": "388 bps",
        "evidence_chain": [{
            "evidence": "TLB trades ~40bps wide of the BB cohort despite lower leverage and stronger "
                        "FCF conversion.",
            "source_doc": "Internal RV Model + Master_Pricing_Run.xlsx", "confidence": 0.78,
            "risk_mechanic": "Spread dislocation vs peers signals relative cheapness, subject to the "
                             "add-back-quality caveat from CP-2.",
            "credit_implication": "25–35bps of tightening potential into the next refi window.",
            "anchor": {"document_id": "doc-acme-q3", "clause_id": "c-cfo-leverage", "quote": "5.7x"},
        }],
    },
    "cp4c.summary": {
        "id": "cp4c.summary", "module": "CP-4C", "label": "Tightest Constraint", "value": "Capex 88%",
        "evidence_chain": [{
            "evidence": "capex for the quarter ran at $45M against our covenanted annual basket of "
                        "$50M, leaving limited incremental capacity.",
            "source_doc": "Q3 Earnings Call Transcript", "confidence": 0.82,
            "risk_mechanic": "Capex basket near exhaustion limits maintenance/expansion flexibility.",
            "credit_implication": "Reduced operational headroom if growth capex must accelerate.",
            "anchor": {"document_id": "doc-acme-q3", "clause_id": "c-cov-capex",
                       "quote": "covenanted annual basket of $50M"},
        }],
    },
    "cp4c.total-net-leverage": {
        "id": "cp4c.total-net-leverage", "module": "CP-4C", "label": "Total Net Leverage", "value": "5.7x / 6.5x",
        "evidence_chain": [{
            "evidence": "net leverage ratio is comfortably at 5.7x, well within our covenant limits.",
            "source_doc": "Q3 Earnings Call Transcript", "confidence": 0.88,
            "risk_mechanic": "0.8x of headroom to the 6.5x springing trigger.",
            "credit_implication": "Adequate but not generous cushion; sensitive to add-back reversal.",
            "anchor": {"document_id": "doc-acme-q3", "clause_id": "c-cfo-leverage",
                       "quote": "well within our covenant limits"},
        }],
    },
    "cp4c.capex-limit-m": {
        "id": "cp4c.capex-limit-m", "module": "CP-4C", "label": "Capex Limit ($M)", "value": "45 / 50",
        "evidence_chain": [{
            "evidence": "capex for the quarter ran at $45M against our covenanted annual basket of $50M.",
            "source_doc": "Q3 Earnings Call Transcript", "confidence": 0.9,
            "risk_mechanic": "Only $5M (10%) of basket capacity remains.",
            "credit_implication": "Binding constraint on incremental investment this period.",
            "anchor": {"document_id": "doc-acme-q3", "clause_id": "c-cov-capex",
                       "quote": "annual basket of $50M"},
        }],
    },
    "cp6e.consensus": {
        "id": "cp6e.consensus", "module": "CP-6E", "label": "Consensus Posture", "value": "BUY · 72/100",
        "evidence_chain": [{
            "evidence": "plan to prioritize deleveraging over the next 12-18 months.",
            "source_doc": "Q3 Earnings Call Transcript", "confidence": 0.7,
            "risk_mechanic": "Stated deleveraging intent supports the long thesis if FCF holds.",
            "credit_implication": "Constructive on the TLB at a 1.5% NAV sizing with a 30bps target.",
            "anchor": {"document_id": "doc-acme-q3", "clause_id": "c-ceo-close",
                       "quote": "prioritize deleveraging"},
        }],
    },
}


def _agent_output_rows() -> list[dict]:
    return [
        {"module_id": "CP-0", "status": "COMPLETED", "severity": "PASS", "blocked_reason": None,
         "output": {"verdict": "READY", "source_quality": "HIGH", "confidence": 0.94}},
        {"module_id": "CP-1", "status": "COMPLETED", "severity": "PASS", "blocked_reason": None,
         "output": {"total_debt_mm": 1200, "tranches": [
            {"name": "Revolving Credit Facility", "type": "RCF", "amount_mm": 200, "currency": "USD",
             "maturity": "2029-06", "rate": "SOFR+300", "seniority_rank": 1, "lien_position": 1},
            {"name": "First Lien Term Loan B", "type": "TLB", "amount_mm": 850, "currency": "USD",
             "maturity": "2030-06", "rate": "SOFR+375", "seniority_rank": 1, "lien_position": 1},
            {"name": "Senior Unsecured Notes", "type": "Notes", "amount_mm": 150, "currency": "USD",
             "maturity": "2031-01", "rate": "7.250%", "seniority_rank": 3, "lien_position": 0}]}},
        {"module_id": "CP-2", "status": "COMPLETED", "severity": "PASS", "blocked_reason": None,
         "output": {
            "business_description": "Diversified technology holding company.",
            "credit_thesis_md": (
                "### Earnings Quality\n"
                "Management reports **LTM Adjusted EBITDA of $210M**, but this figure includes "
                "**$45.2M of add-backs** [[cite:0]] — primarily GlobalTech restructuring and "
                "stock-based comp. On a reported basis, leverage is materially higher than the "
                "headline.\n\n"
                "### Leverage\n"
                "Stated net leverage of **5.7x** [[cite:0]] sits inside the springing covenant, but "
                "ex-add-backs we estimate ~6.0x. The deleveraging path depends on sustained FCF.\n"),
            "historical_periods": [
                {"period": "FY2022", "revenue_mm": 1580, "ebitda_mm": 188, "ebitda_margin_pct": 0.119,
                 "net_leverage_x": 6.1, "interest_coverage_x": 2.4, "fcf_mm": 70, "capex_mm": 130},
                {"period": "FY2023", "revenue_mm": 1720, "ebitda_mm": 201, "ebitda_margin_pct": 0.117,
                 "net_leverage_x": 5.9, "interest_coverage_x": 2.6, "fcf_mm": 88, "capex_mm": 140}],
            "ltm_period": {"period": "LTM Q3-2023", "revenue_mm": 1800, "ebitda_mm": 210,
                           "ebitda_margin_pct": 0.117, "net_leverage_x": 5.7,
                           "interest_coverage_x": 3.1, "fcf_mm": 96, "capex_mm": 150}}},
        {"module_id": "CP-3", "status": "COMPLETED", "severity": "PASS", "blocked_reason": None,
         "output": {
            "subject_spread_bps": 388, "subject_net_leverage_x": 5.7, "fair_value_verdict": "CHEAP",
            "rv_commentary_md": (
                "The TLB screens **CHEAP**: roughly **40bps wide** of the BB technology cohort "
                "[[cite:0]] despite comparable leverage and stronger free-cash-flow conversion. We "
                "see **25–35bps** of tightening into the next refinancing window."),
            "comparables": [
                {"issuer_name": "Peer A", "net_leverage_x": 5.2, "spread_bps": 350, "ytw_pct": 8.1},
                {"issuer_name": "Peer B", "net_leverage_x": 4.9, "spread_bps": 360, "ytw_pct": 8.2},
                {"issuer_name": "Peer C", "net_leverage_x": 5.6, "spread_bps": 372, "ytw_pct": 8.5},
                {"issuer_name": "Peer D", "net_leverage_x": 6.0, "spread_bps": 410, "ytw_pct": 9.0}]}},
        {"module_id": "CP-4C", "status": "COMPLETED", "severity": "WARNING", "blocked_reason": None,
         "output": {
            "liquidity_runway_months": 19, "rcf_availability_mm": 200,
            "capacity_commentary_md": (
                "**Capex basket utilization at 88%** is the tightest constraint [[cite:0]]. "
                "Maintenance leverage and coverage tests retain comfortable headroom; the binding "
                "near-term limit is incremental capex capacity."),
            "headroom_items": [
                {"covenant_name": "Total Net Leverage", "limit_value": 6.5, "actual_value": 5.7,
                 "headroom_pct": 12.3, "severity": "WARNING"},
                {"covenant_name": "Interest Coverage", "limit_value": 2.0, "actual_value": 3.1,
                 "headroom_pct": 35.5, "severity": "OK"},
                {"covenant_name": "Fixed Charge Cov.", "limit_value": 1.1, "actual_value": 1.4,
                 "headroom_pct": 21.4, "severity": "OK"},
                {"covenant_name": "Capex Limit ($M)", "limit_value": 50, "actual_value": 45,
                 "headroom_pct": 10.0, "severity": "WARNING"}]}},
        {"module_id": "CP-6E", "status": "COMPLETED", "severity": "PASS", "blocked_reason": None,
         "output": {
            "consensus_posture": "BUY", "composite_score": 72,
            "final_recommendation": "Initiate at the TLB; size 1.5% NAV with a 30bps tightening target.",
            "debate_rationale_md": (
                "Consensus **BUY** at **72/100**. The RV desk leans into the ~40bps spread pickup; "
                "Compliance flags the sponsor-friendly covenant package and the add-back quality "
                "[[cite:0]]. The CIO sizes at **1.5% NAV** given the stated deleveraging path."),
            "debate_agents": [
                {"persona": "RV_TRADER", "posture": "BUY", "conviction": 4,
                 "thesis": "Cheap vs cohort with a clear refi catalyst.",
                 "key_risks": ["Add-back reversal", "Tech-spend cyclicality"],
                 "key_supports": ["40bps pickup", "Improving FCF"]},
                {"persona": "COMPLIANCE", "posture": "HOLD", "conviction": 3,
                 "thesis": "Sponsor-friendly docs; watch the springing trigger.",
                 "key_risks": ["Weak covenant package", "EBITDA add-backs"],
                 "key_supports": ["First-lien coverage", "No near-term maturities"]},
                {"persona": "CIO", "posture": "BUY", "conviction": 4,
                 "thesis": "Risk/reward favorable for a core BB sleeve.",
                 "key_risks": ["Cyclical demand"],
                 "key_supports": ["Deleveraging trajectory", "Attractive entry"]}]}},
    ]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")

    def _send(self, status, body=None):
        self.send_response(status)
        self._cors()
        if body is not None:
            payload = json.dumps(body).encode()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        else:
            self.end_headers()

    def _body_json(self):
        n = int(self.headers.get("Content-Length", 0) or 0)
        if not n:
            return {}
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            return {}

    def do_OPTIONS(self):
        self._send(204)

    def _run_status(self, run):
        elapsed = time.monotonic() - run["_started"]
        status = "RUNNING" if elapsed < RUN_DURATION_SECONDS else "COMPLETED"
        return {"dag_run_id": run["dag_run_id"], "issuer_id": run["issuer_id"],
                "run_type": run["run_type"], "status": status}

    def do_GET(self):
        p = urlparse(self.path)
        path = p.path.rstrip("/") or "/"
        qs = parse_qs(p.query)
        if path in ("/api/health", "/api"):
            return self._send(200, {"status": "ok", "service": "caos-demo-mock"})
        if path == "/api/auth/me":
            return self._send(200, {"id": "00000000-0000-0000-0000-0000000000aa",
                                    "email": "analyst@fund.com", "full_name": "Demo Analyst",
                                    "role": "analyst", "is_active": True})
        if path == "/api/issuers":
            return self._send(200, ISSUERS)
        if path.endswith("/documents") and path.startswith("/api/issuers/"):
            iid = path.split("/")[3]
            return self._send(200, [
                {"id": "doc-" + iid[:8] + "-om", "doc_type": "OM",
                 "file_name": "Offering Memorandum.pdf",
                 "uploaded_at": "2026-06-01T09:00:00Z", "fiscal_period": None},
                {"id": "doc-" + iid[:8] + "-ir", "doc_type": "InterimReport",
                 "file_name": "Q1-26 Interim Report.pdf",
                 "uploaded_at": "2026-06-08T09:00:00Z", "fiscal_period": "Q1-2026"},
            ])
        if path.endswith("/document") and path.startswith("/api/issuers/"):
            return self._send(200, DOCUMENT)
        if path.endswith("/conclusions") and path.startswith("/api/issuers/"):
            return self._send(200, CONCLUSIONS)
        if path.startswith("/api/issuers/"):
            iid = path.rsplit("/", 1)[-1]
            m = next((i for i in ISSUERS if i["id"] == iid), None)
            return self._send(200, m) if m else self._send(404, {"detail": "Issuer not found"})
        if path == "/api/agents/runs":
            issuer_id = (qs.get("issuer_id") or [None])[0]
            runs = []
            if issuer_id and issuer_id in LATEST_RUN_BY_ISSUER:
                runs.append(self._run_status(RUNS[LATEST_RUN_BY_ISSUER[issuer_id]]))
            return self._send(200, runs)
        if path.startswith("/api/agents/runs/") and path.endswith("/outputs"):
            return self._send(200, _agent_output_rows())
        if path.startswith("/api/agents/runs/"):
            rid = path.rsplit("/", 1)[-1]
            run = RUNS.get(rid)
            return self._send(200, self._run_status(run)) if run else self._send(404, {"detail": "nf"})
        return self._send(404, {"detail": f"Unmocked GET {path}"})

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        body = self._body_json()
        if path == "/api/auth/login":
            return self._send(200, {"access_token": "demo-mock-token", "token_type": "bearer"})
        if path == "/api/auth/register":
            return self._send(201, {"id": "00000000-0000-0000-0000-0000000000aa",
                                    "email": body.get("email", "analyst@fund.com"),
                                    "full_name": body.get("full_name", "Demo Analyst"),
                                    "role": "analyst", "is_active": True})
        if path == "/api/issuers":
            new = {"id": str(uuid.uuid4()), "name": body.get("name", "Untitled"),
                   "ticker": body.get("ticker"), "industry": body.get("industry"),
                   "country": body.get("country")}
            ISSUERS.append(new)
            return self._send(201, new)
        if path == "/api/chat/issuer":
            msgs = body.get("messages", [])
            last = next((m.get("content", "") for m in reversed(msgs)
                         if m.get("role") == "user"), "")
            return self._send(200, {"reply": (
                "Clearance is CONDITIONAL because CP-5 holds QA-117 (HIGH) open: "
                "the CP-1C peer-margin citation E-44 points at OM Annex C p.388, "
                "which contains the auditor consent letter, not the peer table. "
                "The committee pack is HELD until remediation R-1 re-anchors E-44; "
                "the debate verdict stands ex-E-44. "
                f"(demo mock reply — asked: \"{last[:80]}\")"
            )})
        if path == "/api/agents/run":
            issuer_id = body.get("issuer_id")
            rid = str(uuid.uuid4())
            RUNS[rid] = {"dag_run_id": rid, "issuer_id": issuer_id, "run_type": "FULL_RUN",
                         "status": "RUNNING", "_started": time.monotonic()}
            LATEST_RUN_BY_ISSUER[issuer_id] = rid
            return self._send(202, self._run_status(RUNS[rid]))
        if path.startswith("/api/ingestion/upload"):
            return self._send(200, {"document_id": str(uuid.uuid4()),
                                    "issuer_id": body.get("issuer_id", ISSUERS[0]["id"]),
                                    "minio_key": "demo/key", "chunks_created": 12,
                                    "message": "Demo upload accepted (mock)."})
        return self._send(404, {"detail": f"Unmocked POST {path}"})


if __name__ == "__main__":
    seed = str(uuid.uuid4())
    RUNS[seed] = {"dag_run_id": seed, "issuer_id": ISSUERS[0]["id"], "run_type": "FULL_RUN",
                  "status": "COMPLETED", "_started": time.monotonic() - 1000}
    LATEST_RUN_BY_ISSUER[ISSUERS[0]["id"]] = seed
    print(f"CAOS demo mock backend on http://localhost:{PORT}  (Ctrl-C to stop)")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
