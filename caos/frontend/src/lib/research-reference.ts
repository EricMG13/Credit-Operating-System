import type { ResearchResult } from "@/lib/api";

export const REFERENCE_RESEARCH_RESULT: ResearchResult = {
  demo: true,
  truncated: false,
  sources: [
    { title: "Illustrative credit agreement extract", url: "https://example.invalid/reference-credit-agreement" },
    { title: "Illustrative quarterly filing extract", url: "https://example.invalid/reference-quarterly-filing" },
  ],
  report: `# Atlas Forge reference credit research

## Executive summary

This seeded example demonstrates the expected committee-ready structure. It is not issuer data, a persisted run, or live web research.

## Detailed findings

- Leverage, liquidity, covenant capacity, and refinancing risk are shown only as illustrative analytical categories.
- Every conclusion in a live report must resolve to producer-supplied citations.

## Recommendations

Use this reference to review format and workflow only. Configure live research before relying on an issuer conclusion.`,
};
