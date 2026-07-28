<!-- CP-X Schema Reference (T3) | 2026-06-03 -->

## Required Output Sections (7)
All 7 sections must be present using exact required headings.

## Required Tables (5)
| ID | Table Name | Key Columns |
|----|-----------|-------------|
| TX.2 | Module Execution Sequence | Order, Module ID, Module Name, Layer, Readiness, Depends On |
| TX.3 | Module Readiness Register | Module ID, Module Name, Readiness Status, Source Dependencies Met, Limitation Flags, Blocking Reason |
| TX.4 | One-Owner-Per-Object Validation | owned_object, Owning Module, Conflict Detected, Resolution |
| TX.5 | Source-to-Module Routing Map | Source Document, Source Quality, Modules Supported, Limitation |
| TX.6 | Limitation Propagation Register | Limitation, Source, Affected Modules, Impact, Propagated Flag |

## Structured Sections (2)
| Step | Section | Format |
|------|---------|--------|
| 1 | Route Plan Source Gate | Gate status (Full Run / Ready with Limitations / Blocked) + CP-0 completeness assessment |
| 7 | Route Plan Summary | Required formulation: "Route plan includes [N] modules for execution ([M] Full Run, [K] Ready with Limitations, [J] Blocked)..." |

## QA Checklist
- [ ] CP-0 output received and validated
- [ ] All modules assessed for readiness (none omitted)
- [ ] Execution sequence is dependency-ordered (layer precedence enforced)
- [ ] One-owner-per-object validated for all modules in execution plan
- [ ] Source-to-module routing complete (every CP-0 source mapped)
- [ ] All CP-0 limitations propagated to affected downstream modules
- [ ] No M-prefix references in any output
- [ ] Single Audit Appendix present (all audit items consolidated)
- [ ] Blocked modules listed with specific blocking reasons
- [ ] Ready with Limitations modules have specific limitation flags
- [ ] No modules added without CP-0 readiness evidence
- [ ] No modules skipped that CP-0 marks as Ready or Ready with Limitations

## Export

Canonical Markdown is the required analytical output and downstream handoff. Author and validate it first. Create an editable DOCX, a visually rich PDF, or both only when requested; verify each view independently. A failed optional view does not invalidate valid Markdown or a successful sibling export.

**Output order: (1) author complete canonical Markdown; (2) validate contract and identity, fail closed; (3) create requested DOCX and/or visual PDF views independently; (4) return concise status, limitations, and links actually created.**

## canonical Markdown [IssuerID]_CP-X_[YYYYMMDD].md — `IssuerID` is exact front-matter `issuer_id`; `YYYYMMDD` is `analysis_date` without hyphens. YAML envelope (incl confidence_score + confidence_band) + canonical H2: ## Audit Summary, ## Analysis, ## Evidence Trace, ## Source Registry, ## Gaps & Conflicts, ## QA Validation. Saved to OneDrive, attached as grounding to next agent.
## Confidence: numeric confidence_score 0-100 (primary, per CP_CONFIDENCE_SCORE.md); confidence_band = derived label (High/Medium/Low/Insufficient Information).
