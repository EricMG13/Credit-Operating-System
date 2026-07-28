<!-- CP-8 Schema Reference (T3) | PROPOSED | 2026-06-22 -->

## Required Output Sections (8)
All 8 sections must be present. Where the observation window is open or a record is missing, the section still appears with [Insufficient Information] and a gap ledger entry.

## Required Tables (8)
| ID | Table Name | Key Columns |
|----|-----------|-------------|
| T7.1 | Decision Record | Action Bias, Posture, Instrument, Size, Decision Date, Decision-Maker Role, Module Status |
| T7.2 | Thesis / Expectation Register | Thesis, Greatest Uncertainty, Flagged Catalysts/Downside Paths, Expected Spread/Return, Expected Rating Path, Expected Hold, Exit Triggers, Evidence ID |
| T7.3 | Realized Outcome Log | Metric, Realized Value, As-of Date, Source, Interim/Final, Evidence ID |
| T7.4 | Variance Table | Metric, Expected, Realized, Variance (direction + magnitude), Confidence, Evidence ID |
| T7.5 | Attribution Table | Variance, Attribution Label, Process Sound? (Y/N), Originating Module (if gap), Basis, Evidence ID |
| T7.6 | Calibration Register (advisory) | Pattern, Target Module, Specific Prior, Supporting Decisions, Advisory Recommendation |
| T7.7 | Track-Record Dashboard | Hit rate, realized-vs-expected by cut (pathway/sector/sponsor), attribution distribution, lessons register |
| T7.8 | Gaps Ledger | Gap, Missing Item, Why It Matters, Impact on Output, Required Follow-Up |

## QA Checklist
- [ ] All 8 output sections present and populated (or [Insufficient Information] with gap logged)
- [ ] Every realized outcome is sourced and dated; none fabricated or estimated
- [ ] Every attribution drawn only from the 6 canonical labels
- [ ] Process quality explicitly separated from outcome in each attribution
- [ ] Flagged-vs-unflagged risk distinguished using T7.2's recorded downside paths
- [ ] Calibration entries gated to ≥3 comparable decisions and marked advisory/non-binding
- [ ] No credit view formed, revised, or overridden
- [ ] No individual named or graded
- [ ] Open observation windows flagged for revisit
- [ ] Source gate status documented (Completed / Completed with Limitations / Blocked)
- [ ] Canonical Markdown valid; every requested DOCX/PDF export passes view-appropriate parity; numeric Confidence Score (0–100) + band present in the Audit Summary/envelope and every generated view

## Confidence
Primary measure is the numeric **Confidence Score (0–100)** computed per `CP_CONFIDENCE_SCORE.md`; the band (High / Medium / Low / Insufficient Information) is the derived label carried in the canonical `confidence_band` envelope field.

## Export

Canonical Markdown is the required analytical output and downstream handoff. Author and validate it first. Create an editable DOCX, a visually rich PDF, or both only when requested; verify each view independently. A failed optional view does not invalidate valid Markdown or a successful sibling export.

**Output order: (1) author complete canonical Markdown; (2) validate contract and identity, fail closed; (3) create requested DOCX and/or visual PDF views independently; (4) return concise status, limitations, and links actually created.**
