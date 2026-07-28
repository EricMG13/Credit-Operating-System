# CP-3D A — Market evidence gate

Verify each instrument using a reliable identifier and source-supported coupon, maturity/call, currency, issuer/guarantor and seniority. Do not map a quote to an instrument by abbreviated name alone. Record the market source, entitlement/usage limitation, observation timestamp, quote type (`bid`, `ask`, `mid`, `evaluated`, `last_trade`) and whether the market was open.

Define freshness appropriate to the instrument and question. A liquid bond's stale evaluated price and an illiquid distressed bond's last trade require different caveats. If a requested price/spread cannot be observed, mark `[Insufficient Information]`; do not search model memory for a plausible value.

