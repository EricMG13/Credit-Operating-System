# Analyst onboarding (H3)

Audience: a new buy-side credit analyst joining the CAOS pilot.

## Access

1. Sign in with your firm Google account at the CAOS URL (domain-restricted;
   out-of-domain accounts are refused at the edge). The firm sign-in admits
   you to the desk; the analyst profile below is the identity stamped on
   every run, note, and decision record — that's why there are two gates.
2. First visit: register in two quick steps — **identity** (name, email,
   passcode, and the private invite code from the platform owner), then
   **security** (three recovery words, each confirmed). The words are your
   only way back into the account: no email reset exists on this desk.

## The workspace: five stages, six flagship concepts (plus Ask)

The nav groups every surface by workflow stage — the six flagship concepts
are in **bold**. Alt+←/→ cycles surfaces in this order.

| Stage | Surfaces | What you do there |
|---|---|---|
| Intake & Runs | Directory · Upload · **Pipeline** | Register an issuer, attach filings, start a run, watch the 19-module DAG execute |
| Analyze | Research · Query · Sector Review · RV Screener · Sponsors | Cross-issuer questions, sector context, RV screening, sponsor books |
| Decide | **Command Center** · Portfolio Lab · **Deep-Dive** · **Model Builder** · IC Book | Desk posture and "what changed"; the credit work: module outputs with claim → evidence → source chunk (every number one click from its filing); scenario/downside mechanics; the append-only decision record |
| Publish | **Report Studio** | Committee-ready tear-sheet assembly (paper output, print-ready) |
| Monitor | **Alert Monitor** | Watch rules + alert inbox (rules fire on governed outputs, never on vibes) |

**Ask (⌘K)** works from every surface: cross-issuer questions against
everything the vault knows.

## Your first issuer (the golden path)

1. Directory → **+ NEW ISSUER**. The name is enough to start; ratings are
   never typed — they arrive from ingested structured sheets.
2. Upload → select the issuer, drop ALL deal documents, pick the run mode,
   and start the run (US filer: the EDGAR lane pulls XBRL + filings
   keylessly; non-US: the annual-report PDF is malware-scanned, then parsed).
3. Follow the run in Pipeline (the intake result step links you straight to
   it). CP-1 builds the FactPack; CP-5 is the QA gate — a
   **Restricted/Blocked** state is the system being honest, not broken: open
   the gate report to see which check tripped.
4. Deep-Dive: verify the reads you'd defend in committee — click any figure
   through to its source chunk.
5. Report Studio: assemble the tear-sheet; reference-labeled data stays
   visibly reference-only.
6. IC Book: record your reco/conviction/dissent in the IC Decision Record
   (append-only). Coverage is live from that moment — set your watch rules
   in Alert Monitor so it stays watched.

## Rules of the road

- Reference/sample data is always labeled; it can never satisfy a live case.
- LLM-assisted text is marked; every AI-derived claim carries its evidence
  chain or it doesn't ship.
- A failed upload, feed, or model lane degrades visibly ("unavailable", never
  silent zeros). Report anything that looks silently wrong — that's a gap-log
  entry (F3), and confirmed wrong reads become permanent golden tests (F4).
- Support intake: [SUPPORT_MODEL.md](SUPPORT_MODEL.md).
