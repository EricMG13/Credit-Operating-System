# Consolidated companion — REF_CP-1C_04_BenchmarkAnalysis.md

<!-- MERGED_FROM:REF_CP-1C_04A_OperatingBenchmark.md sha256=18eafee8f07f09d9b94eb2f5a859e77970bd3fce156473afa127e95c17d98ce1 -->
## Source: REF_CP-1C_04A_OperatingBenchmark.md

<!-- REF_CP-1C_04A (T2) | 2026-06-02 -->
<step_reference module="CP-1C" step="04A" name="Operating Benchmark Table">
<input>T4.1 + T4.2</input>
<gate>Alignment complete</gate>

## Instructions
Borrower-vs-peer operating metrics. Include peer statistics per rules (min 3 median, 5 avg). State N.

## Output
T4.3: `Entity`|`Revenue`|`Rev Growth`|`Gross Margin`|`EBITDA`|`EBITDA Margin`|`EBIT Margin`|`Period`|`Currency`|`Calc Status`|`Comp Status`
</step_reference>

<!-- MERGED_FROM:REF_CP-1C_04B_CashFlowCapitalIntensity.md sha256=e9a4c4facff36657420b6cb72526394ebfdc6488882bf8486c70497e7563e6bb -->
## Source: REF_CP-1C_04B_CashFlowCapitalIntensity.md

<!-- REF_CP-1C_04B (T2) | 2026-06-02 -->
<step_reference module="CP-1C" step="04B" name="Cash Flow & Capital Intensity">
<input>T4.1 + T4.2</input>
<gate>Alignment complete</gate>

## Instructions
Borrower-vs-peer cash flow and capex. Same cell specs as 4A.

## Output
T4.4: `Entity`|`FCF`|`FCF Conversion`|`Capex/Rev`|`Capex/EBITDA`|`WC/Rev`|`Period`|`Currency`|`Calc Status`|`Comp Status`
</step_reference>

<!-- MERGED_FROM:REF_CP-1C_04C_CreditMetricBenchmark.md sha256=1296366f1090f1289860e88a67b65ca6dc5fb3473d837bae79b02ae3a888535c -->
## Source: REF_CP-1C_04C_CreditMetricBenchmark.md

<!-- REF_CP-1C_04C (T2) | 2026-06-02 -->
<step_reference module="CP-1C" step="04C" name="Credit Metric Benchmark">
<input>T4.1 + T4.2</input>
<gate>Alignment complete</gate>

## Instructions
Borrower-vs-peer leverage, coverage, liquidity. Same specs.

## Output
T4.5: `Entity`|`Total Lev`|`Net Lev`|`Sr Sec Lev`|`Int Coverage`|`Adj Int Coverage`|`FFO/Debt`|`Liquidity`|`Period`|`Currency`|`Calc Status`|`Comp Status`
</step_reference>

<!-- MERGED_FROM:REF_CP-1C_04D_SummaryStatistics.md sha256=3f5c23947791ed3e4dd336fec00fe1abf26aa9f282c17add64fdf6a164884717 -->
## Source: REF_CP-1C_04D_SummaryStatistics.md

<!-- REF_CP-1C_04D (T2) | 2026-06-02 -->
<step_reference module="CP-1C" step="04D" name="Summary Statistics">
<input>T4.3+T4.4+T4.5</input>
<gate>≥1 benchmark table</gate>

## Instructions
Summary peer statistics with borrower positioning. Min 3 for median, 4 quartile, 5 avg. <2 → no stats.

## Output
T4.6: `Metric`|`Borrower Value`|`Peer Avg`|`Median`|`Min`|`Max`|`Q1`|`Q3`|`N`|`Borrower Position`
</step_reference>
