import type { Capability } from "@/lib/query/graph";

export const ANALYST_MEMO_PROMPT = {
  id: "analyst-memos",
  text: "Show analyst notes / memos",
  sub: "vault links",
};

export const QUERY_KEYWORDS: [string, string][] = [
  ["profile", "peer-profile"], ["peer", "peer-set"], ["energy", "contagion"], ["co-move", "contagion"],
  ["contagion", "contagion"], ["theme", "shared-theme"], ["flag", "shared-theme"], ["mention", "shared-theme"],
  ["note", "analyst-memos"], ["notes", "analyst-memos"], ["memo", "analyst-memos"], ["memos", "analyst-memos"],
  ["analyst note", "analyst-memos"], ["commentary", "analyst-memos"],
  ["sector", "concentration-map"], ["concentration", "concentration-map"], ["cluster", "concentration-map"],
  ["scatter", "scatter"], ["percentile", "distribution"], ["rank", "distribution"], ["trend", "metric-trend"],
  // Metric keywords: the scatter walk IS leverage × interest-coverage, so route
  // "which issuers have leverage above 5x" there; net debt is the same cross-plot.
  ["leverage", "scatter"], ["coverage", "scatter"], ["interest coverage", "scatter"], ["net debt", "scatter"],
  ["ebitda", "distribution"], ["margin", "distribution"],
  ["verdict", "trace-source"], ["trace", "trace-source"], ["source", "trace-source"], ["lineage", "lineage-audit"],
  ["orphan", "orphan-claims"], ["ungrounded", "orphan-claims"], ["impact", "impact-analysis"],
  ["coverage", "coverage-completeness"], ["finding", "open-findings"], ["lane", "gate-lane"],
  ["committee", "committee-board"], ["debate", "debate-digest"], ["tension", "tension"],
  ["disagree", "tension"], ["diff", "run-diff"], ["changed", "run-diff"], ["sponsor", "sponsor-graph"],
];

export function rankQueryCapabilities(text: string, capabilities: Capability[]) {
  const q = text.trim().toLowerCase();
  const tokens = q.split(/\W+/).filter(Boolean);
  const aliasBy = new Map<string, string[]>();
  for (const [kw, id] of QUERY_KEYWORDS) aliasBy.set(id, [...(aliasBy.get(id) ?? []), kw]);

  return capabilities
    .map((c) => {
      const labelWords = c.label.toLowerCase().split(/\W+/);
      let s = 0;
      for (const a of aliasBy.get(c.id) ?? []) if (q.includes(a)) s += 2;
      for (const t of tokens) if (labelWords.includes(t)) s += 1;
      return { c, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || Number(b.c.enabled) - Number(a.c.enabled));
}
