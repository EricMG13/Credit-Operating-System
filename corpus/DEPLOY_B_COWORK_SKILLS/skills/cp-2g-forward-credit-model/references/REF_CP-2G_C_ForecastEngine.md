# CP-2G C — Forecast engine

Build the shortest model that answers the credit question while covering the full refinancing horizon. Prefer eight quarters plus three annual periods when evidence supports quarterly granularity. Avoid false precision when only annual guidance exists.

For each case and period calculate operating results, CFO, capex, FCF, cash interest, debt issuance/repayment, closing debt/cash, accessible liquidity, leverage and coverage. Show formulas or formula IDs. Reconcile opening balances to the prior closing period and log any residual.

Debt and cash flows must respect entity perimeter. Never net securitised or matched-funding finance-company debt against industrial cash. Do not count restricted, trapped or operationally required cash as accessible without support. Do not assume undrawn revolvers are available when covenant or borrowing-base conditions are unknown.

