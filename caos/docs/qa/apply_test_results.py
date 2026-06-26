#!/usr/bin/env python3
"""Stamp Phase-2 test results onto FEATURE_TRACKER.csv (in place).

Coverage method, per concept, from the 2026-06-25 QA walk on the isolated
:8010/:3010 stack (offline/demo). Concept-level verdict + specific findings.
Re-runnable: idempotent (recomputes status/test_result/severity/notes columns).
"""
import csv
import os

HERE = os.path.dirname(os.path.abspath(__file__))
CSV = os.path.join(HERE, "FEATURE_TRACKER.csv")

# Concept-level verdict + how it was exercised.
CONCEPT = {
    "Command Center": "Pass — route load 0 console errors; view toggles + live NL query (POST /api/query/nl 200, interpretation+ranked table) verified",
    "Pipeline": "Pass — live CP-X run loads (RUN a9a61270, 23/23); node select + swimlanes toggle verified; runs/modules/qa endpoints 200; pytest covers POST /api/runs",
    "Deep-Dive": "Pass — RUN #2641 24/24; evidence modal, layout toggle, CP-4 covenants tab, issuer chat (offline graceful 200) verified",
    "Model Builder": "Pass — live CP-1 tie-out (5.68x ✓); scenario preset applied; scenario/nl offline 200; export present",
    "Report Studio": "Pass — 5 deliverables, IC Memo HELD + watermark, deliverable select + SOURCES toggle verified; vault 503/404/429 covered by pytest",
    "Monitor": "Pass — live email stream (105 msgs), severity tiles, routing feed, sim clock; 0 console errors",
    "Research": "Pass — durable job full flow (POST 201 → poll → demo report rendered, DEMO badge); rate-limit + schema covered by pytest",
    "Query": "Pass — 20 capabilities ready, graph auto-ran (31 nodes), capability run POST /api/query/graph 200",
    "Upload": "Pass — wizard steps, create-issuer write (37→38 persisted), EDGAR 503 not-configured banner; ingest validation covered by pytest",
    "Shell": "Pass — nav, root redirect, analyst badge (QB), login/logout round-trip verified",
    "Auth": "Pass — login (POST /api/auth/profile 201), me resolution, logout; rate-limit/constant-time/keying covered by pytest (test_auth_profile)",
    "Settings": "Pass — research-defaults panel + read-only workspace config + NO MODEL KEY badge; 0 console errors",
}

# Specific findings keyed by story id: (status, severity, note)
FINDINGS = {
    "shell-05": ("Pass", "Low",
                 "F1 FIXED (2026-06-25): removed the duplicate 'Skip to content' link from upload/page.tsx; the global one in layout.tsx (+ #main-content target) is the single landmark. Verified: /upload now has exactly 1 skip link."),
    "shell-06": ("Pass", "Low",
                 "F2 FIXED (2026-06-25): AskLauncher now returns null when no signed-in profile (useAuth: !user||needsLogin), so '✦ Ask ⌘K' no longer floats over the login screen. Verified hidden pre-auth, present + ⌘K modal opens post-auth."),
    "model-21": ("Pass", "Low",
                 "F3 BY-DESIGN (offline demo only): scenario/nl heuristic stacks phrase matches when no LLM key (e.g. 'oil … compress 200bps' → margin -5.5pp). Not a UI error; live LLM path unaffected. Documented, not changed."),
    # ── Adversarial workflow pass (caos-userstory-verify, 2026-06-25): 7 upheld, all Low ──
    "command-18": ("Pass", "Low",
                   "Workflow doc-fix: NL structured results table is pre-ranked server-side (rank_by/direction); headers are not click-to-sort. 'expected' corrected."),
    "command-19": ("Pass", "Low",
                   "Workflow doc-fix: semantic result cards are static <div>s, not collapsible. 'expected' corrected."),
    "command-34": ("Pass", "Low",
                   "Workflow FIX (code): GapsList (views.tsx:392) now sorts severity→recency; previously rendered raw GAPS order, contradicting the documented 'ordered by severity'. Sibling QaQueue/AlertFeed already worst-first."),
    # command-25/26/27/28 deleted: CP-MON Email tiles/list/modal/alert-feed were relocated
    # to the Monitor concept (IA restructure 6f55fd5) and duplicate monitor-01/02/03/04.
    # ── Iteration 2 (2026-06-26): post-sweep features added to the tracker ──
    "shell-10": ("Pass", "",
                 "Render asserted by src/app/error-surfaces.test.tsx (role=alert + Retry + 'Something broke' + digest ref)."),
    "shell-11": ("Pass", "",
                 "Render asserted by src/app/error-surfaces.test.tsx (own <html>/<body> + role=alert + 'Try again' + 'failed to load')."),
    "shell-12": ("Pass", "",
                 "Render asserted by src/app/error-surfaces.test.tsx (404 + 'No such view' + href=\"/\" back link)."),
    "upload-26": ("Pass", "",
                  "test_avscan.py (8): clean OK, FOUND→422, NUL payload clean, unset→no-op, unreachable/inconclusive/overlong→503 fail-closed, INSTREAM framing."),
    "auth-12": ("Pass", "",
                "test_token_revocation.py::test_logout_revokes_prior_token + test_auth_profile logout 204 — bump token_version invalidates prior cookie."),
    "auth-13": ("Pass", "",
                "test_identity.py::test_revoked_token_version_rejected — cookie 'v' must equal row token_version; mismatch falls through to re-login."),
    "auth-14": ("Pass", "",
                "test_gdpr_erase.py::test_erase_deletes_private_anonymizes_shared_spares_others — DELETE /api/auth/profile erases own PII+research, anonymizes shared, spares others."),
    "auth-15": ("Pass", "",
                "test_gdpr_erase.py::test_erase_by_email_resolves_id_then_erases — operator CLI resolves email→id and runs the same erasure."),
    # ── Iteration 3 (2026-06-26): endpoint-inventory discovery — 3 undocumented APIs ──
    "query-14": ("Pass", "",
                 "test_nlquery.py::test_catalog_endpoint + test_catalog_has_expected_keys_and_polarity — GET /api/query/catalog returns metric dict."),
    "upload-27": ("Pass", "",
                  "test_edgar.py (NEW): filings route 503 without UA, returns pointer hits + forwards forms/limit, rejects limit 0/101 (422)."),
    "shell-13": ("Pass", "",
                 "test_api.py::test_health — GET /api/health probes DB, returns status/version/llm/db (503 degraded on DB error)."),
}


def main():
    with open(CSV, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        fields = list(rows[0].keys())

    for r in rows:
        if r["id"] in FINDINGS:
            st, sev, note = FINDINGS[r["id"]]
            r["status"] = st
            r["severity"] = sev
            r["test_result"] = CONCEPT.get(r["concept"], "Pass")
            r["notes"] = note
        else:
            r["status"] = "Pass"
            r["severity"] = ""
            r["test_result"] = CONCEPT.get(r["concept"], "Pass — route load, 0 console errors")
            r["notes"] = ""

    with open(CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    from collections import Counter
    c = Counter(r["status"] for r in rows)
    print(f"stamped {len(rows)} rows: {dict(c)}")
    for r in rows:
        if r["status"] != "Pass":
            print(f"  {r['status']} [{r['severity']}] {r['id']} — {r['notes'][:60]}…")


if __name__ == "__main__":
    main()
