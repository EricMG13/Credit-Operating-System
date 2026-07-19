// Deterministic plain-English answer line — rendered above the chart so every
// result leads with its "so what". Pure templates over the graph payload; no
// LLM, so it is exactly as defensible as the graph itself. Anything the
// templates can't ground falls back to title + meta.

import type { GraphResult, GraphNode } from "@/lib/query/graph";

const fallback = (g: GraphResult) =>
  g.meta.length ? `${g.title} — ${g.meta.join(" · ")}.` : `${g.title}.`;

// Cluster pills ship their size as a "· N" label suffix (e.g. "Industrials · 3").
// That decoration must never leak into a sentence — it reads as part of the name
// and, worse, doubles as a count the sentence claims to have derived itself.
const stripCount = (label: string): string => label.replace(/\s*·\s*\d+\s*$/, "");

export function synthesize(g: GraphResult): string {
  if (g.nodes.length === 0) return g.meta[0] || g.title;
  // Capability-aware branches first: a few walks share a mode but carry a
  // different node vocabulary (memos are documents, not claims; scatter has no
  // clusters), so the generic mode template would misread them.
  switch (g.capability_id) {
    case "analyst-memos": return memos(g);
    case "scatter": return scatter(g);
    case "covenant-register": return covenantRegister(g);
    case "sponsor-graph": return sponsorGraph(g);
    case "head-to-head": return headToHead(g);
  }
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

function genuineSectorMember(edge: GraphResult["edges"][number], sectorIds: Set<string>, byId: Map<string, GraphNode>): string | null {
  if (edge.kind !== "member") return null;
  const sectorId = sectorIds.has(edge.source) ? edge.source : sectorIds.has(edge.target) ? edge.target : null;
  if (!sectorId) return null;
  const otherId = sectorId === edge.source ? edge.target : edge.source;
  return byId.get(otherId)?.kind === "issuer" ? sectorId : null;
}

function sectorMemberCounts(g: GraphResult, sectors: GraphNode[]): Map<string, number> {
  const sectorIds = new Set(sectors.map((sector) => sector.id));
  const byId = new Map(g.nodes.map((node) => [node.id, node]));
  const members = new Map(sectors.map((sector) => [sector.id, 0]));
  for (const edge of g.edges) {
    const sectorId = genuineSectorMember(edge, sectorIds, byId);
    if (sectorId) members.set(sectorId, (members.get(sectorId) ?? 0) + 1);
  }
  return members;
}

function concentrationSummary(sectors: GraphNode[], members: Map<string, number>): string {
  const counts = sectors.map((sector) => members.get(sector.id) ?? 0);
  const max = Math.max(...counts);
  const clusters = `Coverage splits into ${sectors.length} ${sectors.length === 1 ? "cluster" : "clusters"}`;
  if (max === 0) return `${clusters}.`;
  const leaders = sectors.filter((sector) => (members.get(sector.id) ?? 0) === max);
  if (leaders.length > 1) return `${clusters}${counts.every((count) => count === max) ? " — evenly split" : ""}.`;
  const top = stripCount(leaders[0].label);
  return `${clusters}; the largest is ${top} with ${max} ${max === 1 ? "name" : "names"}.`;
}

function concentration(g: GraphResult): string {
  const sectors = g.nodes.filter((n) => n.kind === "sector");
  if (sectors.length === 0) return fallback(g);
  // Count only genuine issuer members of each sector: a "member" edge whose one
  // endpoint is a sector and whose *other* endpoint is an issuer node. This
  // excludes hub↔sector edges (the wiki walk hangs sectors off a "center"), which
  // otherwise inflated every cluster by one; the sector's own "· N" label suffix
  // is likewise never read as a count.
  // A superlative is only honest with a strict maximum (no tie for first) and a
  // grounded count. On a tie or an ungrounded count, stay neutral — and call an
  // even split what it is.
  return concentrationSummary(sectors, sectorMemberCounts(g, sectors));
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

// Analyst memos ride the provenance mode but are documents linked to one focus
// issuer, not claims through modules — so count the memos honestly against the
// focus rather than falling through to the (name-repeating) meta join.
function memos(g: GraphResult): string {
  const focus = g.nodes.find((n) => n.kind === "center" || n.center);
  const n = g.nodes.filter((n) => n.kind === "claim").length;
  if (!focus) return fallback(g);
  return `${n} analyst ${n === 1 ? "memo" : "memos"} linked to ${focus.label} across the vault.`;
}

// Scatter positions issuers on two metric axes — there are no clusters to name.
// Read the axes off the "x = …" / "y = …" meta entries (the builder emits them);
// only fall back to the canonical pair if both are literally present.
function scatter(g: GraphResult): string {
  const issuers = g.nodes.filter((n) => n.kind === "issuer").length;
  const axis = (p: string): string | null => {
    const raw = g.meta.find((m) => m.trim().toLowerCase().startsWith(`${p} =`));
    if (!raw) return null;
    // "x = net leverage →" → "net leverage" (drop the axis-direction arrow).
    return raw.slice(raw.indexOf("=") + 1).replace(/[→↑↓←]/g, "").trim() || null;
  };
  const x = axis("x");
  const y = axis("y");
  if (!issuers || !x || !y) return fallback(g);
  return `${issuers} ${issuers === 1 ? "issuer" : "issuers"} positioned by ${x} × ${y}.`;
}

// Covenant register: issuers split by structure (maintenance vs cov-lite), read
// off each issuer node's group. Cov-lite is the loan-market norm — the "so what"
// is how many maintenance names run thin headroom (<1.0x), never a "largest
// cluster" superlative (that would misread a register as sector concentration).
function covenantRegister(g: GraphResult): string {
  const issuers = g.nodes.filter((n) => n.kind === "issuer");
  if (issuers.length === 0) return fallback(g);
  const maint = issuers.filter((n) => n.group === "Maintenance covenant");
  const covlite = issuers.filter((n) => n.group === "Cov-lite");
  const thin = maint.filter((n) => n.flag).length;
  const tail = thin ? `; ${thin} running thin headroom (<1.0x)` : "";
  return `${issuers.length} ${issuers.length === 1 ? "issuer" : "issuers"} by covenant structure — ${maint.length} maintenance, ${covlite.length} cov-lite${tail}.`;
}

// Sponsor graph: issuers hung off sponsor hubs (kind "sector"). Name the sponsor
// backing the most names only on a strict maximum >1 (a book of one-name sponsors
// has no meaningful "largest").
function sponsorGraph(g: GraphResult): string {
  const sponsors = g.nodes.filter((n) => n.kind === "sector");
  const issuers = g.nodes.filter((n) => n.kind === "issuer");
  if (sponsors.length === 0 || issuers.length === 0) return fallback(g);
  const sizes = new Map<string, number>(sponsors.map((s) => [s.id, 0]));
  for (const e of g.edges) {
    if (e.kind !== "member") continue;
    const hub = sponsors.find((s) => s.id === e.source || s.id === e.target);
    if (hub) sizes.set(hub.id, (sizes.get(hub.id) ?? 0) + 1);
  }
  const max = Math.max(...sizes.values());
  const leaders = sponsors.filter((s) => (sizes.get(s.id) ?? 0) === max);
  const lead = leaders.length === 1 && max > 1
    ? `; ${stripCount(leaders[0].label)} backs the most (${max})`
    : "";
  return `${issuers.length} sponsor-owned ${issuers.length === 1 ? "issuer" : "issuers"} across ${sponsors.length} ${sponsors.length === 1 ? "sponsor" : "sponsors"}${lead}.`;
}

// Head-to-head: one "sector" group node per compared row, two "issuer" members
// (one per side) underneath. The "so what" is the CP-3 relative-value read when
// both sides have one — higher composite percentile = stronger vs peers
// (relval.py's own polarity, not a judgment made here); anything else stays a
// neutral row count so the sentence never claims more than the data supports.
function headToHead(g: GraphResult): string {
  const rows = g.nodes.filter((n) => n.kind === "sector").length;
  if (!rows) return fallback(g);
  const base = `${g.title} compared across ${rows} ${rows === 1 ? "row" : "rows"}`;
  const rv = g.nodes.filter((n) => n.kind === "issuer" && n.group === "CP-3 relative value");
  const pctOf = (n: GraphNode): number | null => {
    const m = n.sub?.match(/^(\d+(?:\.\d+)?)th pctile/);
    return m ? Number(m[1]) : null;
  };
  if (rv.length === 2) {
    const [a, b] = rv;
    const pa = pctOf(a);
    const pb = pctOf(b);
    if (pa !== null && pb !== null && pa !== pb) {
      const [stronger, weaker] = pa > pb ? [a, b] : [b, a];
      return `${base} — ${stronger.label} screens stronger on relative value than ${weaker.label}.`;
    }
  }
  return `${base}.`;
}
