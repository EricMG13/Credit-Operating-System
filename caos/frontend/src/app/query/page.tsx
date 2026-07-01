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
import { RelativeValueTable } from "@/components/query/RelativeValueTable";
import { ScatterCanvas } from "@/components/query/ScatterCanvas";
import { LineageFlow } from "@/components/query/LineageFlow";
import { CitationViewer } from "@/components/command/CitationViewer";
import { useNotify } from "@/components/shared/Notifications";
import { queryCapabilities, queryGraph } from "@/lib/api";
import type { Capability, CapabilitiesResult, GraphResult, GraphNode } from "@/lib/query/graph";
import { downloadQueryCsv } from "@/lib/query/export";
import { ANALYST_MEMO_PROMPT, rankQueryCapabilities } from "@/lib/query/routing";

export default function QueryPage() {
  return (
    <RequireAuth>
      <Query />
    </RequireAuth>
  );
}

// Predefined prompts, richest-first; the page shows the first few that are
// runnable given what's stored (so the suggestions never offer a dead edge).
type QueryPrompt = { id: string; text: string; sub: string };

const PROMPTS: QueryPrompt[] = [
  { id: "peer-set", text: "Map peers by credit profile", sub: "issuer graph · CP-1C" },
  { id: "contagion", text: "Co-move under an energy shock", sub: "contagion overlay · CP-2" },
  { id: "concentration-map", text: "Cluster coverage by sector", sub: "sector clusters" },
  { id: "scatter", text: "Plot leverage × coverage", sub: "cross-issuer scatter" },
  { id: "trace-source", text: "Trace the IC verdict to its sources", sub: "provenance walk" },
  ANALYST_MEMO_PROMPT,
  { id: "open-findings", text: "Show open QA findings", sub: "governance" },
];

const PREFER = ["peer-set", "contagion", "concentration-map", "scatter", "trace-source"];
const LAYOUTS = [
  { id: "graph", label: "Graph" },
  { id: "trace", label: "Lineage" },
  { id: "rv", label: "Table" },
  { id: "scatter", label: "Scatter" },
] as const;

function Query() {
  return <QueryWorkspace />;
}

function QueryWorkspace({ prompts: promptSet = PROMPTS }: { prompts?: QueryPrompt[] }) {
  const [caps, setCaps] = useState<CapabilitiesResult | null>(null);
  const [capsErr, setCapsErr] = useState<string | null>(null);
  const [graph, setGraph] = useState<GraphResult | null>(null);
  const [graphErr, setGraphErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<{ text: string; capId: string; capLabel: string }[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("caos:query-history");
      if (stored) setHistory(JSON.parse(stored));
    } catch (e) {
      console.warn("Could not load history", e);
    }
  }, []);

  const addToHistory = useCallback((searchText: string, capId: string, capLabel: string) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.text.toLowerCase() !== searchText.toLowerCase() && h.capId !== capId);
      const next = [{ text: searchText, capId, capLabel }, ...filtered].slice(0, 5);
      try {
        localStorage.setItem("caos:query-history", JSON.stringify(next));
      } catch (e) {
        console.warn("Could not save history", e);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("caos:query-focus", handleFocus);
    return () => {
      window.removeEventListener("caos:query-focus", handleFocus);
    };
  }, []);
  const [note, setNote] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<Capability[]>([]);
  const [cite, setCite] = useState<{ id: string; label?: string | null } | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [layout, setLayout] = useState<"graph" | "trace" | "rv" | "scatter">("graph");
  const notify = useNotify();

  const capById = useMemo(() => {
    const m = new Map<string, { label: string; enabled: boolean; reason: string | null }>();
    caps?.groups.forEach((g) => g.capabilities.forEach((c) => m.set(c.id, c)));
    return m;
  }, [caps]);
  const totalCaps = caps?.groups.reduce((s, g) => s + g.total, 0) ?? 0;
  const totalReady = caps?.groups.reduce((s, g) => s + g.ready, 0) ?? 0;
  const activeCap = activeId ? capById.get(activeId) : null;
  const selectNode = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setInspectorOpen(true);
  }, []);

  const runSeq = useRef(0);
  const run = useCallback((capId: string, toast = false) => {
    // Ignore out-of-order results: a slow earlier queryGraph must not clobber a newer
    // one (graph/error/running guarded on the latest sequence). (review run-2 #FR2)
    const seq = ++runSeq.current;
    setActiveId(capId);
    setRunning(true);
    setGraphErr(null);
    setNote(null);
    setSuggest([]);
    setSelectedNode(null);
    setInspectorOpen(false);
    queryGraph(capId)
      .then((g) => {
        if (seq === runSeq.current) setGraph(g);
        if (toast) notify("Query complete", g.title);
      })
      .catch((e) => {
        if (seq !== runSeq.current) return;
        const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          || (e as Error)?.message || "could not run query";
        setGraphErr(String(d));
        notify("Query failed", String(d));
      })
      .finally(() => { if (seq === runSeq.current) setRunning(false); });
  }, [notify]);

  // Load capabilities, then auto-run the first runnable preferred capability so the
  // surface opens on a live graph, not an empty canvas.
  useEffect(() => {
    let cancelled = false;
    queryCapabilities()
      .then((c) => {
        if (cancelled) return;
        setCaps(c);
        const enabled = new Set(c.groups.flatMap((g) => g.capabilities.filter((x) => x.enabled).map((x) => x.id)));
        const promptPreference = promptSet.map((p) => p.id);
        const first = [...promptPreference, ...PREFER].find((id) => enabled.has(id)) || [...enabled][0];
        if (first) run(first);
      })
      .catch((e) => {
        if (!cancelled) setCapsErr((e as Error)?.message || "could not load capabilities");
      });
    return () => { cancelled = true; };
  }, [promptSet, run]);

  const prompts = useMemo(
    () => promptSet.filter((p) => capById.get(p.id)?.enabled).slice(0, 5),
    [capById, promptSet]
  );

  // Score every capability by alias hits (weight 2) + label-word overlap (weight 1),
  // run the best *enabled* match, and never dead-end: a miss or a greyed best match
  // surfaces the closest runnable capabilities as did-you-mean chips.
  const submit = useCallback(() => {
    const q = text.trim().toLowerCase();
    if (!q) return;
    const allCaps = caps?.groups.flatMap((g) => g.capabilities) ?? [];
    const scored = rankQueryCapabilities(q, allCaps);
    const runnable = scored.filter((x) => x.c.enabled).map((x) => x.c);
    if (scored.length === 0) {
      setNote("No capability matched. Try one of these:");
      setSuggest(allCaps.filter((c) => c.enabled).slice(0, 4));
      return;
    }
    const best = scored[0].c;
    if (best.enabled) {
      addToHistory(text, best.id, best.label);
      run(best.id, true);
      return;
    }
    setNote(`${best.label} — ${best.reason}. Runnable instead:`);
    setSuggest(runnable.slice(0, 4));
  }, [text, caps, run, addToHistory]);

  return (
    <div className="h-screen flex flex-col">
      <PageSubHeader gap="gap-4">
        <QueryMark />
        <div className="min-w-0">
          <div className="tabular text-caos-xl text-caos-text font-semibold leading-none">Query</div>
          <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted leading-none mt-1">
            run-derived graph search
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 overflow-hidden">
          <MetricPill label="ready" value={caps ? `${totalReady}/${totalCaps}` : "loading"} />
          <MetricPill label="active" value={activeCap?.label ?? "none"} />
          {running && <span className="tabular text-caos-2xs text-caos-accent caos-running">walking graph</span>}
        </div>
      </PageSubHeader>

      <div className="flex-1 min-h-0 flex bg-caos-bg">
        <CapabilityRail
          groups={caps?.groups ?? []}
          activeId={activeId}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          onPick={run}
        />

        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <section className="shrink-0 border-b border-caos-border bg-caos-panel/55 px-4 py-3">
            <div className="flex items-center gap-2 bg-caos-bg border border-caos-border rounded-md px-3 py-2 focus-within:border-caos-accent/70 transition-caos">
              <QueryMark small />
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="Ask across coverage — or pick a starting point below"
                aria-label="Query coverage"
                className="flex-1 bg-transparent outline-none tabular text-caos-xl text-caos-text placeholder:text-caos-muted"
              />
              <button
                type="button"
                onClick={submit}
                className="tabular text-caos-md px-3 py-1 rounded bg-caos-accent text-caos-bg font-medium hover:opacity-90 transition-caos focus-ring"
              >
                Run
              </button>
            </div>
            {note && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="tabular text-caos-sm text-caos-warning flex items-center gap-1">
                  <span aria-hidden>!</span>
                  {note}
                </span>
                {suggest.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => run(c.id)}
                    className="tabular text-caos-2xs px-2 py-0.5 rounded border border-caos-accent/50 text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

          {history.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted">Recent Queries</div>
                <div className="h-px flex-1 bg-caos-border" />
                <div className="tabular text-caos-3xs text-caos-muted font-mono">recent searches & clicks</div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {history.map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setText(h.text);
                      run(h.capId);
                    }}
                    className={
                      "shrink-0 text-left bg-caos-bg border rounded-md px-3 py-1.5 min-h-[46px] transition-caos focus-ring max-w-[200px] border-caos-border hover:border-caos-accent/50 hover:bg-caos-elevated/35"
                    }
                  >
                    <div className="tabular text-caos-xs text-caos-text truncate leading-normal" title={h.text}>
                      &quot;{h.text}&quot;
                    </div>
                    <div className="tabular text-caos-3xs text-caos-muted font-mono mt-0.5 truncate">
                      → {h.capLabel}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {prompts.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted">Runnable now</div>
                <div className="h-px flex-1 bg-caos-border" />
                <div className="tabular text-caos-3xs text-caos-muted font-mono">grounded in stored data</div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {prompts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      addToHistory(p.text, p.id, capById.get(p.id)?.label ?? p.text);
                      run(p.id);
                    }}
                    className={
                      "w-[190px] shrink-0 text-left bg-caos-bg border rounded-md px-3 py-2 min-h-[58px] transition-caos focus-ring " +
                      (p.id === activeId ? "border-caos-accent caos-selected" : "border-caos-border hover:border-caos-accent/50 hover:bg-caos-elevated/35")
                    }
                  >
                    <div className="tabular text-caos-md text-caos-text leading-snug">{p.text}</div>
                    <div className="tabular text-caos-3xs text-caos-muted font-mono mt-1">{p.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          </section>

          <ResultHeader graph={graph} running={running} activeLabel={activeCap?.label ?? null} selectedNode={selectedNode} />
          {graph ? (
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b border-caos-border bg-caos-bg flex-wrap">
              <div className="flex border border-caos-border rounded bg-caos-panel/40 p-0.5">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLayout(l.id)}
                    className={`tabular text-caos-3xs uppercase tracking-wider px-2 py-0.5 rounded transition-caos cursor-pointer font-mono ${
                      layout === l.id
                        ? "bg-caos-accent text-caos-bg font-semibold"
                        : "text-caos-muted hover:text-caos-text hover:bg-caos-elevated/40"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInspectorOpen((v) => !v)}
                  className={`tabular text-caos-xs px-2 py-1 rounded border transition-caos cursor-pointer font-semibold ${
                    inspectorOpen
                      ? "border-caos-accent text-caos-accent bg-caos-accent/10"
                      : "border-caos-border text-caos-muted hover:text-caos-text"
                  }`}
                  title="Toggle Evidence Panel"
                >
                  EVIDENCE
                </button>
                <button
                  type="button"
                  onClick={() => downloadQueryCsv(graph)}
                  className="tabular text-caos-xs px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos"
                >
                  EXPORT CSV
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="tabular text-caos-xs px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
                >
                  PRINT / PDF
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex-1 min-h-0 flex flex-col m-4 mt-3 bg-caos-bg border border-caos-border rounded-md p-2">
            {capsErr ? (
              <Center text={`Couldn't load capabilities — ${capsErr}`} warn />
            ) : graphErr ? (
              <Center text={`Query failed — ${graphErr}`} warn />
            ) : !graph ? (
              <Center text={running ? "Walking the graph…" : "Pick a capability to render its graph."} />
            ) : layout === "rv" ? (
              <RelativeValueTable
                graph={graph}
                selectedNodeId={selectedNode?.id}
                onSelectNode={selectNode}
              />
            ) : layout === "scatter" ? (
              <ScatterCanvas
                graph={graph}
                selectedNodeId={selectedNode?.id}
                onSelectNode={selectNode}
              />
            ) : layout === "trace" ? (
              <LineageFlow
                graph={graph}
                selectedNodeId={selectedNode?.id}
                onSelectNode={selectNode}
              />
            ) : (
              <GraphCanvas 
                graph={graph} 
                onOpenChunk={(id, label) => setCite({ id, label })} 
                onSelectNode={selectNode}
              />
            )}
          </div>

          {graph && graph.caveats.length > 0 && (
            <div className="shrink-0 tabular text-caos-3xs text-caos-muted font-mono flex items-start gap-1.5 px-4 pb-3">
              <span aria-hidden>i</span>
              <span>{graph.caveats.join(" · ")}</span>
            </div>
          )}
        </main>

        {inspectorOpen && (
          <aside 
            className="hidden xl:flex w-[340px] border-l border-caos-border bg-caos-panel flex-col overflow-y-auto shrink-0 relative transition-caos"
            aria-label="Evidence"
          >
            {selectedNode ? (
              <>
                <div className="p-4 flex items-start justify-between border-b border-caos-border bg-caos-elevated/35">
                  <div>
                    <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-accent font-mono">
                      {selectedNode.kind.replace("-", " ")}
                    </span>
                    <h2 className="tabular text-caos-md font-mono text-caos-text mt-0.5 leading-snug break-all">
                      {selectedNode.label}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="text-caos-muted hover:text-caos-text text-caos-xs font-mono px-1.5 focus-ring"
                    title="Clear selection"
                  >
                    CLEAR
                  </button>
                </div>

                <div className="flex-1 flex flex-col gap-3 min-h-0 p-4">
                  {selectedNode.sub && (
                    <div>
                      <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-0.5">Description</div>
                      <div className="text-caos-sm text-caos-text leading-relaxed font-sans">{selectedNode.sub}</div>
                    </div>
                  )}

                  {selectedNode.title && (
                    <div>
                      <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-0.5">Summary / Detail</div>
                      <div className="text-caos-xs text-caos-text/90 leading-relaxed bg-caos-bg/50 border border-caos-border rounded p-2.5 font-mono whitespace-pre-wrap">
                        {selectedNode.title}
                      </div>
                    </div>
                  )}

                  {selectedNode.group && (
                    <div>
                      <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-0.5">Category Group</div>
                      <span className="tabular text-caos-2xs text-caos-text bg-caos-bg border border-caos-border rounded px-1.5 py-0.5 inline-block">
                        {selectedNode.group}
                      </span>
                    </div>
                  )}

                  {selectedNode.confidence && (
                    <div>
                      <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-0.5">Confidence Score</div>
                      <span
                        className="tabular text-caos-2xs font-semibold px-2 py-0.5 rounded border"
                        style={{
                          color: selectedNode.confidence === "High" ? "var(--caos-success)" : "var(--caos-warning)",
                          borderColor: (selectedNode.confidence === "High" ? "var(--caos-success)" : "var(--caos-warning)") + "55",
                          backgroundColor: (selectedNode.confidence === "High" ? "var(--caos-success)" : "var(--caos-warning)") + "11",
                        }}
                      >
                        {selectedNode.confidence}
                      </span>
                    </div>
                  )}
                </div>

                {selectedNode.obsidian_url && (
                  <div className="pt-3 border-t border-caos-border shrink-0">
                    <a
                      href={selectedNode.obsidian_url}
                      className="w-full flex items-center justify-center gap-1.5 tabular text-caos-xs font-semibold py-2 px-3 rounded bg-caos-accent text-caos-bg hover:opacity-90 transition-caos text-center focus-ring"
                    >
                      <span>REVEAL IN OBSIDIAN WIKI</span>
                      <span aria-hidden className="text-caos-2xs">↗</span>
                    </a>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <QueryMark />
                <div className="tabular text-caos-xs font-mono uppercase tracking-wider text-caos-text mt-3 mb-1">Evidence</div>
                <div className="text-caos-2xs text-caos-muted font-mono max-w-xs leading-normal">
                  Select a node to inspect grounding evidence.
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {cite && <CitationViewer chunkId={cite.id} label={cite.label} onClose={() => setCite(null)} />}
    </div>
  );
}

function QueryMark({ small = false }: { small?: boolean }) {
  const size = small ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <span className={`${size} shrink-0 rounded-sm border border-caos-accent/70 bg-caos-accent/15 text-caos-accent flex items-center justify-center`} aria-hidden="true">
      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 stroke-current" fill="none" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 6h8M6 2v8" />
      </svg>
    </span>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 max-w-[120px] sm:max-w-[220px] inline-flex items-center gap-1 rounded border border-caos-border bg-caos-bg px-1.5 py-0.5 sm:px-2 sm:py-1">
      <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted hidden md:inline">{label}</span>
      <span className="tabular text-caos-2xs text-caos-text truncate">{value}</span>
    </span>
  );
}

function ResultHeader({
  graph,
  running,
  activeLabel,
  selectedNode,
}: {
  graph: GraphResult | null;
  running: boolean;
  activeLabel: string | null;
  selectedNode: GraphNode | null;
}) {
  if (!graph) return null;
  return (
    <div className="shrink-0 flex items-start gap-3 px-4 py-3 border-b border-caos-border bg-caos-panel">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="tabular text-caos-3xs uppercase tracking-wide text-caos-accent border border-caos-accent/40 bg-caos-accent/10 rounded px-1.5 py-px">
            {graph.mode}
          </span>
          {activeLabel && <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted">{activeLabel}</span>}
          {running && <span className="tabular text-caos-2xs text-caos-muted caos-running">running</span>}
          {selectedNode && (
            <span className="tabular text-caos-3xs uppercase tracking-wide text-caos-success border border-caos-success/40 bg-caos-success/10 rounded px-1.5 py-px flex items-center gap-1">
              <span>Selected:</span>
              <span className="font-mono truncate max-w-[120px]">{selectedNode.label}</span>
            </span>
          )}
        </div>
        <h1 className="tabular text-caos-hero text-caos-text font-semibold mt-1 truncate">{graph.title}</h1>
        {!selectedNode && (
          <div className="tabular text-caos-3xs text-caos-muted font-mono mt-0.5">
            Select a node to inspect grounding evidence.
          </div>
        )}
      </div>
      <div className="hidden md:flex items-center gap-2 flex-wrap justify-end max-w-[42%]">
        {graph.meta.map((m, i) => (
          <span key={i} className="tabular text-caos-2xs text-caos-muted font-mono whitespace-nowrap border border-caos-border rounded px-1.5 py-1 bg-caos-bg">
            {m}
          </span>
        ))}
      </div>
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
