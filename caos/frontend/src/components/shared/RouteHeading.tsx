"use client";

// Route-level <h1> for every page — visually hidden (sr-only) so each route gets
// exactly one top heading landmark for assistive tech without touching the dense
// visual chrome. Lives in the root layout, so new routes inherit it for free.
// Visible in-page titles stay as <h2> content headings under this.
import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "": "CAOS",
  command: "Command Center",
  pipeline: "Pipeline",
  deepdive: "Deep-Dive",
  model: "Model Builder",
  reports: "Report Studio",
  research: "Research",
  issuers: "Issuers",
  upload: "Upload",
  settings: "Settings",
  query: "Query",
  monitor: "Monitor",
  sector: "Sector Review",
  "sector-rv": "Sector RV",
  sponsors: "Sponsor Track Records",
};

export function RouteHeading() {
  const seg = (usePathname() || "/").split("/")[1] || "";
  return <h1 className="sr-only">{TITLES[seg] ?? "CAOS"}</h1>;
}
