// Deterministic plain-English answer line — rendered above the chart so every
// result leads with its "so what". Pure templates over the graph payload; no
// LLM, so it is exactly as defensible as the graph itself. Anything the
// templates can't ground falls back to title + meta.

import type { GraphResult, GraphNode } from "@/lib/query/graph";

const fallback = (g: GraphResult) =>
  g.meta.length ? `${g.title} — ${g.meta.join(" · ")}.` : `${g.title}.`;

export function synthesize(g: GraphResult): string {
  if (g.nodes.length === 0) return g.meta[0] || g.title;
  switch (g.mode) {
    case "peers": return peers(g);
    case "contagion": return contagion(g);
    case "concentration": return concentration(g);
    case "provenance": return provenance(g);
    default: return fallback(g);
  }
}

function peers(g: GraphResult): string {
  const center = g.nodes.find((n) => n.kind === "center" || n.center);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const first = g.edges.find((e) => e.label === "#1");
  const nearest: GraphNode | undefined = first
    ? byId.get(first.target === center?.id ? first.source : first.target)
    : undefined;
  const count = g.nodes.filter((n) => n.kind === "issuer").length;
  if (!center || !nearest || !count) return fallback(g);
  const sector = nearest.group ? ` (${nearest.group})` : "";
  return `${center.label}'s nearest peer on credit profile is ${nearest.label}${sector}, of ${count} ranked by profile distance.`;
}

function contagion(g: GraphResult): string {
  const driver = g.nodes.find((n) => n.kind === "driver");
  const issuers = g.nodes.filter((n) => n.kind === "issuer");
  const exposed = issuers.filter((n) => n.exposed).length;
  if (!driver || issuers.length === 0) return fallback(g);
  return `${exposed} of ${issuers.length} issuers in coverage link to the ${driver.label} driver — a shared-exposure overlay.`;
}

function concentration(g: GraphResult): string {
  const sectors = g.nodes.filter((n) => n.kind === "sector");
  if (sectors.length === 0) return fallback(g);
  const members = new Map<string, number>();
  for (const e of g.edges) {
    if (e.kind !== "member") continue;
    for (const end of [e.source, e.target]) {
      if (sectors.some((s) => s.id === end)) members.set(end, (members.get(end) ?? 0) + 1);
    }
  }
  const top = [...sectors].sort((a, b) => (members.get(b.id) ?? 0) - (members.get(a.id) ?? 0))[0];
  const n = members.get(top.id) ?? 0;
  if (!n) return `Coverage splits into ${sectors.length} clusters.`;
  return `Coverage splits into ${sectors.length} clusters; the largest is ${top.label} with ${n} ${n === 1 ? "name" : "names"}.`;
}

function provenance(g: GraphResult): string {
  const count = (k: string) => g.nodes.filter((n) => n.kind === k).length;
  const modules = count("module");
  const claims = count("claim");
  const sources = count("evidence") + count("chunk");
  const flagged = g.nodes.filter((n) => n.flag).length;
  if (!claims || !modules) return fallback(g);
  const tail = flagged ? `; ${flagged} flagged weak` : "";
  return `${claims} ${claims === 1 ? "claim" : "claims"} traced through ${modules} ${modules === 1 ? "module" : "modules"} to ${sources} ${sources === 1 ? "source" : "sources"}${tail}.`;
}
