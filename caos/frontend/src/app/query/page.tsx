"use client";

// Concept H — Query: the standalone search surface that *traverses* the
// run-derived store. Where Command Center's Ask flattens the metric store and
// ranks a column, Query walks edges — peer links, the provenance chain, the
// module DAG, sector clusters — and renders each as a graph. The centre is a
// search engine with a few predefined, data-grounded prompts; the left rail lists
// every capability grouped by edge type, greyed when its edge can't be walked yet.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { PageSubHeader } from "@/components/shared/PageSubHeader";
import { CapabilityRail } from "@/components/query/CapabilityRail";
import { GraphCanvas } from "@/components/query/GraphCanvas";
import { CitationViewer } from "@/components/command/CitationViewer";
import { queryCapabilities, queryGraph } from "@/lib/api";
import type { Capability, CapabilitiesResult, GraphResult } from "@/lib/query/graph";

export default function QueryPage() {
  return (
    <RequireAuth>
      <Query />
    </RequireAuth>
  );
}

// Predefined prompts, richest-first; the page shows the first few that are
// runnable given what's stored (so the suggestions never offer a dead edge).
const PROMPTS: { id: string; text: string; sub: string }[] = [
  { id: "peer-set", text: "Map peers by credit profile", sub: "issuer graph · CP-1C" },
  { id: "contagion", text: "Co-move under an energy shock", sub: "contagion overlay · CP-2" },
  { id: "concentration-map", text: "Cluster coverage by sector", sub: "sector clusters" },
  { id: "scatter", text: "Plot leverage × coverage", sub: "cross-issuer scatter" },
  { id: "trace-source", text: "Trace the IC verdict to its sources", sub: "provenance walk" },
  { id: "open-findings", text: "Show open QA findings", sub: "governance" },
];

const PREFER = ["peer-set", "contagion", "concentration-map", "scatter", "trace-source"];

// Plain-language → capability routing for the search box (no metric to rank here,
// so this maps intent to an edge to walk rather than authoring a query).
const KEYWORDS: [string, string][] = [
  ["profile", "peer-profile"], ["peer", "peer-set"], ["energy", "contagion"], ["co-move", "contagion"],
  ["contagion", "contagion"], ["theme", "shared-theme"], ["flag", "shared-theme"], ["mention", "shared-theme"],
  ["sector", "concentration-map"], ["concentration", "concentration-map"], ["cluster", "concentration-map"],
  ["scatter", "scatter"], ["percentile", "distribution"], ["rank", "distribution"], ["trend", "metric-trend"],
  ["verdict", "trace-source"], ["trace", "trace-source"], ["source", "trace-source"], ["lineage", "lineage-audit"],
  ["orphan", "orphan-claims"], ["ungrounded", "orphan-claims"], ["impact", "impact-analysis"],
  ["coverage", "coverage-completeness"], ["finding", "open-findings"], ["lane", "gate-lane"],
  ["committee", "committee-board"], ["debate", "debate-digest"], ["tension", "tension"],
  ["disagree", "tension"], ["diff", "run-diff"], ["changed", "run-diff"], ["sponsor", "sponsor-graph"],
];

function Query() {
  const [caps, setCaps] = useState<CapabilitiesResult | null>(null);
  const [capsErr, setCapsErr] = useState<string | null>(null);
  const [graph, setGraph] = useState<GraphResult | null>(null);
  const [graphErr, setGraphErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<Capability[]>([]);
  const [cite, setCite] = useState<{ id: string; label?: string | null } | null>(null);

  const capById = useMemo(() => {
    const m = new Map<string, { label: string; enabled: boolean; reason: string | null }>();
    caps?.groups.forEach((g) => g.capabilities.forEach((c) => m.set(c.id, c)));
    return m;
  }, [caps]);

  const runSeq = useRef(0);
  const run = useCallback((capId: string) => {
    // Ignore out-of-order results: a slow earlier queryGraph must not clobber a newer
    // one (graph/error/running guarded on the latest sequence). (review run-2 #FR2)
    const seq = ++runSeq.current;
    setActiveId(capId);
    setRunning(true);
    setGraphErr(null);
    setNote(null);
    setSuggest([]);
    queryGraph(capId)
      .then((g) => { if (seq === runSeq.current) setGraph(g); })
      .catch((e) => {
        if (seq !== runSeq.current) return;
        const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          || (e as Error)?.message || "could not run query";
        setGraphErr(String(d));
      })
      .finally(() => { if (seq === runSeq.current) setRunning(false); });
  }, []);

  // Load capabilities, then auto-run the first runnable preferred capability so the
  // surface opens on a live graph, not an empty canvas.
  useEffect(() => {
    let cancelled = false;
    queryCapabilities()
      .then((c) => {
        if (cancelled) return;
        setCaps(c);
        const enabled = new Set(c.groups.flatMap((g) => g.capabilities.filter((x) => x.enabled).map((x) => x.id)));
        const first = PREFER.find((id) => enabled.has(id)) || [...enabled][0];
        if (first) run(first);
      })
      .catch((e) => {
        if (!cancelled) setCapsErr((e as Error)?.message || "could not load capabilities");
      });
    return () => { cancelled = true; };
  }, [run]);

  const prompts = useMemo(
    () => PROMPTS.filter((p) => capById.get(p.id)?.enabled).slice(0, 5),
    [capById]
  );

  // Score every capability by alias hits (weight 2) + label-word overlap (weight 1),
  // run the best *enabled* match, and never dead-end: a miss or a greyed best match
  // surfaces the closest runnable capabilities as did-you-mean chips.
  const submit = useCallback(() => {
    const q = text.trim().toLowerCase();
    if (!q) return;
    const tokens = q.split(/\W+/).filter(Boolean);
    const allCaps = caps?.groups.flatMap((g) => g.capabilities) ?? [];
    const aliasBy = new Map<string, string[]>();
    for (const [kw, id] of KEYWORDS) aliasBy.set(id, [...(aliasBy.get(id) ?? []), kw]);
    const scored = allCaps
      .map((c) => {
        const labelWords = c.label.toLowerCase().split(/\W+/);
        let s = 0;
        for (const a of aliasBy.get(c.id) ?? []) if (q.includes(a)) s += 2;
        for (const t of tokens) if (labelWords.includes(t)) s += 1;
        return { c, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || Number(b.c.enabled) - Number(a.c.enabled));
    const runnable = scored.filter((x) => x.c.enabled).map((x) => x.c);
    if (scored.length === 0) {
      setNote("No capability matched. Try one of these:");
      setSuggest(allCaps.filter((c) => c.enabled).slice(0, 4));
      return;
    }
    const best = scored[0].c;
    if (best.enabled) { run(best.id); return; }
    setNote(`${best.label} — ${best.reason}. Runnable instead:`);
    setSuggest(runnable.slice(0, 4));
  }, [text, caps, run]);

  return (
    <div className="h-full flex flex-col">
      <PageSubHeader>
        <span className="text-caos-accent text-caos-2xl">✦</span>
        <span className="tabular text-caos-xl text-caos-text font-medium">Query</span>
        <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap">traverse the run-derived store</span>
      </PageSubHeader>

      <div className="flex-1 min-h-0 flex">
        <CapabilityRail
          groups={caps?.groups ?? []}
          activeId={activeId}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          onPick={run}
        />

        <main className="flex-1 min-w-0 flex flex-col p-4 gap-3 overflow-auto">
          <div className="flex items-center gap-2 bg-caos-panel border border-caos-border rounded-md px-3 py-2 focus-within:border-caos-accent/70 transition-caos">
            <span className="text-caos-accent text-caos-2xl">✦</span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="Ask across coverage — or pick a starting point below"
              aria-label="Query coverage"
              className="flex-1 bg-transparent outline-none tabular text-caos-xl text-caos-text placeholder:text-caos-muted"
            />
            <button
              onClick={submit}
              className="tabular text-caos-md px-3 py-1 rounded bg-caos-accent text-caos-bg font-medium hover:opacity-90 transition-caos focus-ring"
            >
              Run
            </button>
          </div>
          {note && (
            <div className="-mt-1 flex items-center gap-2 flex-wrap">
              <span className="tabular text-caos-sm text-caos-warning">{note}</span>
              {suggest.map((c) => (
                <button
                  key={c.id}
                  onClick={() => run(c.id)}
                  className="tabular text-caos-2xs px-2 py-0.5 rounded border border-caos-accent/50 text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {prompts.length > 0 && (
            <div>
              <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-1.5">Runnable now · grounded in stored data</div>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                {prompts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => run(p.id)}
                    className={
                      "text-left bg-caos-panel border rounded-md px-3 py-2 transition-caos focus-ring " +
                      (p.id === activeId ? "border-caos-accent" : "border-caos-border hover:border-caos-accent/50")
                    }
                  >
                    <div className="tabular text-caos-md text-caos-text">{p.text}</div>
                    <div className="tabular text-caos-3xs text-caos-muted font-mono mt-0.5">→ {p.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <ResultHeader graph={graph} running={running} />

          <div className="flex-1 min-h-0 flex flex-col bg-caos-bg border border-caos-border rounded-md p-2" style={{ minHeight: 360 }}>
            {capsErr ? (
              <Center text={`Couldn't load capabilities — ${capsErr}`} warn />
            ) : graphErr ? (
              <Center text={`Query failed — ${graphErr}`} warn />
            ) : !graph ? (
              <Center text={running ? "Walking the graph…" : "Pick a capability to render its graph."} />
            ) : (
              <GraphCanvas graph={graph} onOpenChunk={(id, label) => setCite({ id, label })} />
            )}
          </div>

          {graph && graph.caveats.length > 0 && (
            <div className="tabular text-caos-3xs text-caos-muted font-mono flex items-start gap-1.5">
              <span aria-hidden>ⓘ</span>
              <span>{graph.caveats.join(" · ")}</span>
            </div>
          )}
        </main>
      </div>

      {cite && <CitationViewer chunkId={cite.id} label={cite.label} onClose={() => setCite(null)} />}
    </div>
  );
}

function ResultHeader({ graph, running }: { graph: GraphResult | null; running: boolean }) {
  if (!graph) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="tabular text-caos-3xs uppercase tracking-wide text-caos-accent border border-caos-accent/40 bg-caos-accent/10 rounded px-1.5 py-px">
        {graph.mode}
      </span>
      <span className="tabular text-caos-md text-caos-text">{graph.title}</span>
      {running && <span className="tabular text-caos-2xs text-caos-muted caos-running">running…</span>}
      <span className="flex-1" />
      {graph.meta.map((m, i) => (
        <span key={i} className="tabular text-caos-2xs text-caos-muted font-mono whitespace-nowrap">{m}{i < graph.meta.length - 1 ? " ·" : ""}</span>
      ))}
    </div>
  );
}

function Center({ text, warn }: { text: string; warn?: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-6">
      <div className={"tabular text-caos-xl max-w-md " + (warn ? "text-caos-warning" : "text-caos-muted")}>{text}</div>
    </div>
  );
}
