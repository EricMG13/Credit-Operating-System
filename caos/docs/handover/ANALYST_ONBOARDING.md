# Analyst onboarding (H3)

Audience: a new buy-side credit analyst joining the CAOS pilot.

## Access

1. Sign in with your firm Google account at the CAOS URL (domain-restricted;
   out-of-domain accounts are refused at the edge).
2. First visit: register your analyst profile — name, email, password,
   three recovery words, and the private invite code from the platform owner.
   Your profile is your identity on every run, note, and decision record.

## The six concepts (plus Ask)

| Surface | What you do there |
|---|---|
| **Command Center** | Desk posture: coverage, what changed, live run state |
| **Pipeline** | Onboard an issuer, attach filings, watch the 19-module DAG run |
| **Deep-Dive** | The credit work: module outputs, claim → evidence → source chunk (every number is one click from its filing) |
| **Model Builder** | Scenario/downside mechanics on the governed model |
| **Report Studio** | Committee-ready tear-sheet assembly (paper output, print-ready) |
| **Monitor** | Watch rules + alert inbox (rules fire on governed outputs, never on vibes) |
| **Ask (⌘K)** | Cross-issuer questions against everything the vault knows |

## Your first issuer (the golden path)

1. Pipeline → add issuer (US filer: EDGAR pulls XBRL + filings keylessly;
   non-US: upload the annual report PDF — it is malware-scanned, then parsed).
2. Trigger a run. CP-1 builds the FactPack; CP-5 is the QA gate — a
   **Restricted/Blocked** state is the system being honest, not broken: open
   the gate report to see which check tripped.
3. Deep-Dive: verify the reads you'd defend in committee — click any figure
   through to its source chunk.
4. Report Studio: assemble the tear-sheet; reference-labeled data stays
   visibly reference-only.
5. Decisions: record your reco/conviction/dissent in the IC Decision Record
   (append-only).

## Rules of the road

- Reference/sample data is always labeled; it can never satisfy a live case.
- LLM-assisted text is marked; every AI-derived claim carries its evidence
  chain or it doesn't ship.
- A failed upload, feed, or model lane degrades visibly ("unavailable", never
  silent zeros). Report anything that looks silently wrong — that's a gap-log
  entry (F3), and confirmed wrong reads become permanent golden tests (F4).
- Support intake: [SUPPORT_MODEL.md](SUPPORT_MODEL.md).
