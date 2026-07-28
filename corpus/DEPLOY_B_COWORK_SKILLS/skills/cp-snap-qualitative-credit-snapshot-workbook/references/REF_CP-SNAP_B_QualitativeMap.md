# REF CP-SNAP B — Qualitative Map

Use `_RBOT_MAP` as the sole address and permission authority.

| Owner | Supported fields |
|---|---|
| CP-1A | company, sector, shareholders, country, transaction summary, business description |
| CP-1B | historical performance |
| CP-2 | strengths, weaknesses |
| CP-2B | catalysts and near-term events |

Do not infer permission from yellow fill alone. The supplied layout contains
yellow financial, EBITDA-adjustment, balance-sheet and credit-metric blocks
that are classified `MODEL_DERIVED_SNAPSHOT` and excluded from CP-SNAP.

Also exclude all `VENDOR_MANUAL` cells, including Bloomberg/FIGI, instrument
pricing, bid/ask, guidance/IPT, OID, commitment details, vendor ratings and
analyst recommendation.

Investment Thesis is not a supported yellow V1 field and remains preserved.
