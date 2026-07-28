<!-- REF_CP-8_06 (T2) | PROPOSED | 2026-06-22 -->
<step_reference module="CP-8" step="06" name="Calibration Signal (pattern-gated)">
<input>T7.5 attribution across the decision population.</input>
<gate>Step 5 complete AND at least 3 comparable decisions available. With fewer than 3, record the decision but produce NO calibration recommendation.</gate>

## Instructions
1. Scan the attribution population for a **pattern**: the same directional miss recurring across ≥3 comparable decisions (e.g., "CP-3A recovery estimates ran high in 2L industrials across N cases").
2. For each pattern record: target module, the specific prior to adjust, the evidence list (the decisions exhibiting it), and the advisory recommendation.
3. Mark every calibration entry **advisory / non-binding** — upstream modules are not bound by it; it informs, it does not gate.
4. A single-decision miss is recorded in the ledger but does not trigger a calibration recommendation. Separate process gaps from outcome luck before calling a pattern.

## Output
T7.6: Calibration Register (advisory) — `Pattern`|`Target Module`|`Specific Prior`|`Supporting Decisions`|`Advisory Recommendation`
</step_reference>
