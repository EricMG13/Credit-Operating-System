import type { Issuer } from "@/types/issuers";

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
