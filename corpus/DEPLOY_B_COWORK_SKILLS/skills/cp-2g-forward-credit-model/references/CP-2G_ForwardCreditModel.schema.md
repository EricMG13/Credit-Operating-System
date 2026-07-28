# CP-2G Forward Credit Model schema

## Required analysis tables

| ID | Table | Required fields |
|---|---|---|
| T2H.1 | Source and identity gate | source_id, upstream module/run/period, status, locator, limitation |
| T2H.2 | Historical-to-base bridge | metric, historical actual, LTM/base, adjustment, basis, evidence_id |
| T2H.3 | Assumption register | assumption_id, driver, case, period, value/range, unit, class, source, rationale |
| T2H.4 | Forward operating model | period, case, revenue, EBITDA, margin, CFO, capex, FCF, evidence/assumption IDs |
| T2H.5 | Debt and liquidity roll-forward | period, case, opening debt/cash, issuance, repayment, interest, closing debt/cash, accessible liquidity |
| T2H.6 | Credit metrics | period, case, gross/net leverage, coverage, FCF/debt, liquidity runway, definition IDs |
| T2H.7 | Scenario and breakpoint matrix | driver shock, first break, period, liquidity/covenant/refinancing consequence, recovery action |
| T2H.8 | Deleveraging and monitoring handoff | case, trajectory, target/date, dependency, trigger, downstream module |
| T2H.9 | Gaps and conflicts | item, conflict/gap, affected case/period, model impact, required evidence |

## Calculation controls

- Closing debt = opening debt + issuance/PIK/capitalised interest − contractual and optional repayments ± supported FX/perimeter movements.
- Closing cash = opening cash + CFO − capex − cash interest/taxes/distributions ± supported financing/investing movements.
- FCF definitions must be explicit and inherited from CP-1 unless a labelled alternative is necessary.
- Net leverage uses accessible cash only; finance-company and industrial/company debt and cash remain separate.
- A balancing residual is never silently forced to zero.

## Completion gate

`Complete` requires a reconciled base case, at least one downside case, traceable assumptions, debt/cash roll-forwards and credit-metric continuity. `Complete with Gaps` is permitted when named, bounded assumptions remain. Missing canonical history, identity mismatch or an unreconciled material model break is `Blocked`.

