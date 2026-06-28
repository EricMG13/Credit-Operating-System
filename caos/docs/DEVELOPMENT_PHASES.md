# CAOS — Development & Certification Phases

**Purpose:** the gated path from "engine runs on real filings" to "ready for
enterprise transfer + real market data." Companion to
[LAUNCH_PHASE1.md](LAUNCH_PHASE1.md), [VIASAT_VALIDATION.md](VIASAT_VALIDATION.md),
and [qa/STRESS_TEST_PLAN.md](qa/STRESS_TEST_PLAN.md).

This is the user's 4-phase plan (Pilot → Pilot 2 → Beta → Pre-deployment),
sharpened: two bookend phases added (**Phase 0** freeze/safety-net, **Phase 5**
market-data cutover) and every phase given a **measurable exit gate**. Rationale
for each change is in the chat thread that produced this file.

---

## Conventions (apply to every phase)

### Two corpora — never confuse them

| Corpus | Lives in | Lifecycle | Purpose |
|--------|----------|-----------|---------|
| **Golden set** (sealed) | CI fixtures — `tests/server/golden/` | **never deleted**, grows only | drift alarm: real issuers with frozen known-correct outputs (CP-1 cited to XBRL, leverage, Altman Z, covenant reads). Start with the validated arc — **Viasat, Six Flags, VMO2**. *(Built: VSAT + FUN, EDGAR lane.)* |
| **Production dictionary** (mutable) | live registry | resettable; starts empty | the real issuer coverage analysts build. `LAUNCH_PHASE1` already ships demo-seed OFF. |

> **The Beta "clean the dictionary" step means reset the _production_ registry —
> NOT delete the golden set.** Destroying the regression corpus to "start clean"
> would remove the only thing proving the engine still computes correctly.

### Severity rubric (dual — fault log uses both)

**Correctness** (money behind a wrong read):
- **CRIT** — wrong number reaches a committee-facing surface.
- **HIGH** — number degrades silently (mock masks failure, NaN leak, silent module gate).
- **MED** — right number, wrong/missing provenance or label.
- **LOW** — cosmetic / format.

**Resilience** (from STRESS_TEST_PLAN):
- **CRIT** — whole app down for all users · **HIGH** — subsystem DoS / money / data loss · **MED** — one session degrades but recovers · **LOW** — cosmetic.

**Blocking rule:** CRIT + HIGH block phase exit. MED + LOW are tracked, not blockers.
Do not chase perfection — close the blockers, ticket the rest.

---

## Phase 0 — Freeze & Safety Net  *(prerequisite — new)*

**Goal:** stop certifying a moving target; install the drift alarm; kill silent mock.
**Why added:** engine functions are still being refined today (`.goal/` tournaments:
altman-z, assess-fit, recovery-waterfall, score-vuln, rate-sensitivity,
interest-runway, compute-pathways/deltas, build-scorecard). You cannot certify
math that is still changing, and a numbers platform needs a regression net before
cert, not after.

- [x] **Freeze the engine surface** — the 19 wired modules + in-flight `.goal/` function refinements either land or are explicitly deferred. No new engine functions mid-cert.
- [x] **Build the sealed golden set** — `tests/server/golden/` holds trimmed real companyfacts for **VSAT** + **FUN** (Six Flags), frozen + cross-checked vs VIASAT_VALIDATION.md. Regen via `_capture.py` (one live SEC fetch each).
- [x] **VMO2 golden** — non-US, no SEC companyfacts → fixture added from the **reported-doc lane** (`reported_cp1.py`), not EDGAR.
- [x] **Golden-master regression in CI** — `tests/server/golden/test_golden_cp1.py` recomputes CP-1 from the fixtures offline and **fails on any numeric drift** (revenue, EBITDA, net debt, leverage, coverage, Altman Z'').
- [x] **Kill silent mock fallback** — every pane that renders engine numbers shows live output or an explicit "no data" / "degraded" state; never a mock number tagged `prov=run` (the Viasat **ATLF-fixture gotcha**).
- [x] **Start the fault log** with the dual severity rubric; agree triage convention.

**Exit gate:** golden-master green in CI · no surface can silently substitute mock for live · engine surface frozen.

---

## Phase 1 — Engine Certification (compute layer)  *(your "Pilot testing")*

**Goal:** certify the credit math is correct on real third-party filings at the
**headless / API layer** (the Viasat model), independent of UI.
**Change:** split your "certify the engine" into compute-layer (here) vs
UI-surface (Phase 2). You cannot trust an engine number seen through a UI that is
still half-mock and still being hardened — certify the math first where mock
can't interfere.

- [ ] Run **each golden issuer keyless (EDGAR lane) AND keyed (LLM synth)** end-to-end via `TestClient` — upload → chunk → 19-module DAG → CP-5 gate.
- [ ] Verify the chain Viasat proved: PDF parse · BM25 surfaces the right credit content · **CP-5 QA gate honest** (no rubber-stamp) · provenance `claim → evidence → chunk` on every claim · EDGAR XBRL→CP-1 **cited to `us-gaap:` concepts**.
- [ ] Close the known engine faults before relying on gated outputs: CP-0 content classification ([#25](https://github.com/EricMG13/Credit-Operating-System/issues/25)), CP-4C covenant abstention on a retrievable covenant ([#26](https://github.com/EricMG13/Credit-Operating-System/issues/26)), EDGAR `adj_ebitda` → leverage/coverage ([#27](https://github.com/EricMG13/Credit-Operating-System/issues/27)).
- [ ] **`is_finite_number` guard verified** on every CP-1 divide/multiply (NaN/inf/zero-denominator) — the stated engine invariant.
- [ ] Each confirmed fault → ticket with file pointer + repro; CRIT/HIGH fixed and re-run green.

**Exit gate:** every golden issuer runs clean on both lanes · CP-5 gate trustworthy · zero CRIT/HIGH correctness faults open · outputs match the frozen goldens.

---

## Phase 2 — Feature-complete + Hardened + Concept-link cert (UI surface)  *(your "Pilot 2")*

**Goal:** all 5 concepts live on real data; certified numbers survive the trip
through the UI; the app survives multi-analyst load.
**Change:** folded **resilience hardening** in here. Your plan tests correctness
(real docs, links, dictionary) but never scale — yet the stress plan's CRIT items
(single worker freezes all users, unbounded run queue) will bite a multi-analyst
pilot. "Codebase reviewed and tested" must include closing those.

- [ ] All 5 concepts (Command Center, Pipeline, Deep-Dive, Model Builder, Report Studio) render the certified golden runs from **live engine output — no mock overlay**.
- [ ] **Concept-link suite** (named, repeatable, not a one-time check): cross-pane Evidence Sync selection · click-to-source from any conclusion → evidence → chunk · a run flows Pipeline → Deep-Dive → Model Builder → Report Studio carrying the **same number identical across all 5 surfaces**.
- [ ] Codebase review pass complete (the `.review` cadence) — backend + frontend findings triaged, CRIT/HIGH closed.
- [x] **Stress harness built** — `tests/stress/` (mock-Anthropic w/ 429/529/hang, API seed, locustfile). The lazy ~80% of STRESS_TEST_PLAN §9.
- [ ] **Stress harness run + CRIT/HIGH closed**: single worker freeze, unbounded run queue (CRIT); no Anthropic timeout, no 429 backoff, zero virtualization, unlimited expensive endpoints, key-sprayable limiter, no 401 interceptor, parse timeouts, `vault-exhibit` SSRF (HIGH) — **before** widening access.
- [ ] Re-run golden issuers through the full UI; outputs still match the Phase-0 goldens.

**Exit gate:** 5 concepts on live data · concept-link suite green · zero CRIT/HIGH (correctness OR resilience) open · golden-master still green through the UI.

---

## Phase 3 — Beta: build the dictionary  *(your "Beta")*

**Goal:** real analysts build real coverage; surface gaps/faults only real-world
breadth exposes.
**Change:** "clean dictionary" = reset the **production** registry, **keep the
golden set**. Add a real cohort + a gap log; promote new bug classes into the
golden set.

- [ ] **Reset the production registry to empty** (already the launch default) — KEEP the sealed golden set in CI. Do not delete the regression corpus.
- [ ] Onboard the pilot cohort (**3–5 analysts** per launch runbook); each onboards their own issuers via the real ingestion path.
- [ ] **Coverage + gap log**: issuers attempted vs certifiable; every issuer that fails ingestion/run/gate → categorized gap (e.g. scanned PDF, no OCR → 0 chunks; non-US/IFRS reported-disclosure path; covenant not retrievable).
- [ ] **Feedback loop**: analyst-reported wrong read → correctness fault log → fix → **add that issuer to the golden set** if it exposed a class of bug.
- [ ] Golden-master stays green throughout (fixes don't regress certified issuers).

**Exit gate:** cohort builds N issuers at the target certifiable rate · gap log triaged (CRIT/HIGH closed) · golden set grown with any new bug classes · no open CRIT/HIGH from real usage.

---

## Phase 4 — Pre-deployment (enterprise-ready)  *(your "Pre-deployment")*

**Goal:** fully functional + provably safe to hand to enterprise; everything
except the data source is final.
**Change:** added an explicit **security/compliance gate** and **ops-readiness
gate** — "fully functional" is not the same as "safe to transfer."

- [ ] **Security gate** ([SECURITY.md](SECURITY.md)): no LLM lane has tools/writes (re-verify the known property) · auth / edge-proxy fail-closed · secrets handling · GDPR-delete txn integrity · SSRF allow-list · dependency advisories triaged.
- [ ] **Ops readiness**: CRIT infra fixes shipped (multiple uvicorn workers · run-queue backpressure + per-user cap · DB pool sized · timeouts everywhere); rollback runbook (LAUNCH_PHASE1 §7) rehearsed.
- [ ] **LAUNCH_PHASE1 §5 post-deploy verification gate** passes on the target host.
- [ ] Full golden-master + concept-link + stress regression green on a **prod-parity build** (`.venv311` / fastapi 0.138 pin).
- [ ] **Enterprise transfer checklist**: repo handoff · env/secrets · data residency · single accepted remaining change = market-data source.

**Exit gate:** security gate PASS · ops gate PASS · all regression suites green on prod-parity · transfer checklist signed.

---

## Phase 5 — Market-data cutover  *(promoted from "the only change left")*

**Goal:** swap test market data → real market data as a controlled, reconciled
migration — **not a flip-the-switch**.
**Why a phase:** it is a data-source migration with the same mock↔live risk class
as the engine. Treating it as trivial is how a wrong spread reaches committee on
day one.

- [ ] Wire the real feed behind the **same interface**; schema-parity test test-vs-real.
- [ ] **Parallel-run**: compute DM / spreads / pricing on test vs real data for the golden issuers; reconcile deltas; explain every material diff.
- [ ] **DM stays canonical** (loans-only); confirm the real feed supplies DM's inputs (STW / Z-spread / YTW remain unsuitable per the loans-only decision).
- [ ] Golden-master **re-baselined only for the data-dependent figures**, with sign-off; everything else unchanged.
- [ ] Cutover runbook + rollback to test data.

**Exit gate:** real-data figures reconciled and signed off against the parallel test-data run · golden-master re-baselined · rollback proven.

---

## Phase summary

| Phase | One-line | Hard gate |
|-------|----------|-----------|
| 0 Freeze & safety net | freeze engine, build golden set, kill silent mock | golden-master green; no mock-as-live |
| 1 Engine cert (compute) | math correct on real filings, headless | both lanes clean; 0 CRIT/HIGH correctness |
| 2 Feature + harden + links | 5 concepts live, links proven, scale-hardened | links green; 0 CRIT/HIGH correctness OR resilience |
| 3 Beta | analysts build the dictionary, find gaps | gap log triaged; golden set grown |
| 4 Pre-deployment | safe to transfer to enterprise | security + ops gate PASS |
| 5 Market-data cutover | test → real data, reconciled | reconciled & signed off; rollback proven |
</content>
</invoke>
