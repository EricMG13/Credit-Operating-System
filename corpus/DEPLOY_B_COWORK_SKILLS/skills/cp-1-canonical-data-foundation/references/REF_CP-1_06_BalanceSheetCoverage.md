<!-- REF_CP-1_06_BalanceSheetCoverage (Tier 2) | 2026-06-02 -->
<step_reference module="CP-1" step="6" name="Balance Sheet Coverage">
<input>Normalized source data (Step 3 basis).</input>
<gate>Always executes. If BS unavailable, produce empty table + log gaps.</gate>

## Detailed Instructions
1. Extract + normalize full BS at each reporting date.
2. Required line items:
   Cash & Equivalents | Restricted Cash | ST Investments | Trade Receivables | Inventories | Other CA | Total CA | PP&E (Net) | Goodwill | Other Intangibles | Other NCA | Total Assets | ST Debt | Current Portion LTD | Trade Payables | Other CL | Total CL | Senior Secured Debt | Senior Unsecured Debt | Subordinated Debt | Total Debt | Pension/Lease Obligations | Other NCL | Total Liabilities | Shareholders' Equity | Minority Interests | Total Equity
3. Same source-tracing and null-storage rules.

## Output — T4.6 Balance Sheet
`Line Item` | `Period 1` … `Period N`

## Warnings
- Debt classification by seniority **critical for CP-3**. Not disclosed → null. Do NOT estimate.
- Pension/lease obligations separated from financial debt where possible.

**Non-debt funding liabilities:** a material non-debt, non-interest-bearing liability funding operations (customer deposits / deferred revenue / supplier finance) is credit-relevant working-capital float — flag in T4.6 warnings (size, trend, refund/performance obligation), carry to Step 11 as a named story; never ordinary payables (Canon Core item 8). Also scan the filing's subsequent-events note here.
</step_reference>
