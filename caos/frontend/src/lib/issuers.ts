import type { Issuer } from "@/types/issuers";
import { PORTFOLIO } from "@/lib/command/data";

// Demo sleeve for empty/degraded registry states. PORTFOLIO rows are tranches
// (a borrower repeats once per facility), so dedupe by code — the directory and
// overlay list issuers, and duplicate ids break React keys and profile opens.
export const DEMO_UNIVERSE: Issuer[] = Array.from(
  new Map(
    PORTFOLIO.map((p) => [
      p.code,
      {
        id: p.code,
        name: p.borrower || p.name,
        ticker: p.code,
        sector: p.sector,
        industry: p.sector,
        country: "United States",
      },
    ]),
  ).values(),
);

export const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "France",
  "Germany",
  "Netherlands",
  "Spain",
  "Italy",
  "Sweden",
  "Luxembourg",
  "Ireland",
  "Australia",
  "Other",
];

export function issuerSector(issuer: Pick<Issuer, "sector" | "industry">): string {
  return issuer.sector || issuer.industry || "";
}

export function issuerProfileHref(issuer: Pick<Issuer, "id">): string {
  return "/issuers/profile?id=" + encodeURIComponent(issuer.id);
}

export function issuerSearchHref(q: string): string {
  return "/issuers?q=" + encodeURIComponent(q);
}
