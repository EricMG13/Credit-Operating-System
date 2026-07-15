// Live "mixed origin" governance signal — a portfolio row whose bespoke
// Deep-Dive/Report Studio tabs stay the Atlas Forge reference fixture even
// though a real live run is anchored on it (the FE-5 case already honored by
// Deep-Dive's caveat and Report Studio's own on-screen chip). This is the one
// concrete, non-fabricated "one run, two provenances" signal the live
// portfolio can surface today — everything else (fixture-only issuers) is
// REFERENCE end to end and not a mix.

import type { PortfolioRowDTO, DigestWatchRow } from "@/lib/api";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";

export function liveMixedOrigin(rows: PortfolioRowDTO[]): DigestWatchRow[] {
  return rows
    .filter((r) => r.issuer_id === ATLF_REFERENCE_ISSUER_ID)
    .map((r) => ({
      issuer_id: r.issuer_id,
      name: r.ticker || r.name,
      detail: "Bespoke debate/recovery/covenant tabs stay the Atlas Forge reference fixture; other figures reflect this live run.",
    }));
}
