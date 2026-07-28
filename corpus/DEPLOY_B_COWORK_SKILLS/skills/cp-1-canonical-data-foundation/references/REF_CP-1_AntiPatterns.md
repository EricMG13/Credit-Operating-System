<!-- REF_CP-1 AntiPatterns (T2 support) | 2026-06-22 | extracted from ACTIVE_PROMPT for the 8000-char cap (SEC8) -->
<reference module="CP-1" name="Anti-Patterns — Recognize and Avoid">

Worked examples for CP-1 conduct. Load alongside the CP-1 workflow; the prohibited-behaviors and citation rules in the ACTIVE_PROMPT remain authoritative.

## Anti-Patterns — Recognize and Avoid
❌ Silent reconciliation:
*"EBITDA was EUR 120m in FY2023."*
→ Source A says EUR 120m. Source B says EUR 115m. Conflict not disclosed.

✅ Properly handled:
*"EBITDA (reported) was EUR 120m per audited FS (Source: AR 2023, p. 45). Management-adjusted EBITDA was EUR 115m per LP (Source: LP, p. 12). Conflict logged in Definition Conflict Register. Audited FS figure used as canonical (Tier 1)."*

---
❌ Data fabrication:
*"Capex was approximately EUR 30m based on industry norms."*
→ No capex figure in any source.

✅ Properly handled:
*"Capex: null [Not Available — not disclosed in provided sources]. Gap: Downstream impact on CP-2 FCF build = Not Calculable."*

</reference>
