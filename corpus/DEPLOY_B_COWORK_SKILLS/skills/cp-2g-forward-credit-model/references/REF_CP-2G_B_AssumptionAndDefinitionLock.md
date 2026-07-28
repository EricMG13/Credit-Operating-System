# CP-2G B — Assumption and definition lock

Classify every forecast input as `source_fact`, `management_guidance`, `external_consensus`, `user_assumption`, `calculated`, or `analyst_judgment`. Store exact source and locator or name the user instruction. Do not relabel an analyst estimate as consensus or management guidance.

At minimum consider revenue volume/price/mix, margin, working capital, restructuring costs, capex, cash taxes, cash interest, leases, dividends/distributions, acquisitions/disposals, debt amortisation, refinancing terms, minimum cash and revolver availability. Use null rather than zero when unsupported.

Maintain separate definition IDs for reported EBITDA, CP-1 normalized EBITDA, covenant EBITDA and agency-adjusted metrics. The forward model normally uses CP-1 definitions; downstream modules may recalculate using their governing definitions.

