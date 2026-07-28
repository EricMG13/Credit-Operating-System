# REF CP-MODEL C — Model Math

Use template formulas and the following identities. A missing required input
returns blank/null; a zero denominator returns blank/null.

## Income statement

- Revenue = direct reported revenue.
- Business-unit segment sum includes every dynamic operating-segment row;
  corporate/elimination remains separate. The combined segment reconciliation
  is a check and never replaces reported Revenue.
- COGS is negative.
- Gross Profit = Revenue + COGS.
- Gross Margin = Gross Profit / Revenue.
- OPEX is negative and includes D&A for the visible legacy layout.
- EBIT = Gross Profit + OPEX.
- D&A is a positive add-back.
- EBITDA = EBIT + D&A.
- Adjustments = sum of every issuer-specific identified add-back row.
- If the upstream bridge is explicitly empty, Adjustments = 0.
- Adjusted EBITDA = EBITDA + Adjustments.
- Adjusted EBITDA margin = Adjusted EBITDA / Revenue.

## Cash flow

- FFO = CFO − Change in Working Capital.
- Other = FFO − Adjusted EBITDA − Cash Interest − Leases − Cash Taxes.
- CFO check = FFO + Change in Working Capital.
- FCF = CFO + Capex & Intangible Investment.
- NCF = FCF + acquisitions/disposals + net debt issuance/repayment +
  net equity issuance/repurchase + dividends + other investing/financing.

`Other` is an intentional calculated residual containing operating cash items
not separately stated. It is not a sourced plug. Cash interest and cash taxes
mean cash paid.

## Debt and KPIs

- Secured debt = sum of secured facility carrying values.
- Total debt = secured + unsecured carrying values.
- Senior secured leverage = senior secured debt / LTM Adjusted EBITDA.
- Total leverage = total debt / LTM Adjusted EBITDA.
- Net leverage = (total debt − cash) / LTM Adjusted EBITDA.
- Interest coverage = LTM Adjusted EBITDA / ABS(LTM cash interest).
- FCF / debt = LTM FCF / period-end total debt.
- OPEX / sales = ABS(LTM OPEX) / LTM revenue.
- D&A / sales = LTM D&A / LTM revenue.
- DSO = net A/R / LTM revenue × 365.
- DSI = inventory / ABS(LTM COGS) × 365.
- DPO = A/P / ABS(LTM COGS) × 365.
- Tax Rate = sourced effective rate, else tax expense / pre-tax income.
- Capex / revenue = ABS(LTM capex) / LTM revenue.

Leverage and coverage are null when LTM Adjusted EBITDA is non-positive.
Ratios are null when numerator/denominator is missing or denominator is zero.
