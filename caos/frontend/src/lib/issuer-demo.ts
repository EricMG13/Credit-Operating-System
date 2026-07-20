import type { Issuer } from "@/types/issuers";
import { PORTFOLIO } from "@/lib/command/data";

// Route-scoped demo sleeve for empty/degraded registry states. Keep this in its
// own module: command/data is hundreds of KiB and must not enter the root layout
// merely because the global issuer overlay can fall back to sample coverage.
// PORTFOLIO rows are tranches, so dedupe borrowers by portfolio code.
export const DEMO_UNIVERSE: Issuer[] = Array.from(
  new Map(
    PORTFOLIO.map((position) => [
      position.code,
      {
        id: position.code,
        name: position.borrower || position.name,
        ticker: position.code,
        sector: position.sector,
        industry: position.sector,
        country: "United States",
      },
    ]),
  ).values(),
);
