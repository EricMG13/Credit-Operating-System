"use client";

// Concept H — Query: the standalone surface that traverses the run-derived
// store (peer links, provenance chains, module DAGs, sector clusters) to widen
// analysis beyond a single issuer. Layout is analyst-first: a question rail
// grouped by job, one command bar (suggestions live in its focus dropdown),
// and an answer that always leads with a plain-English synthesis line above
// its native visualization. Views are gated per graph shape and reset on every
// run; a permanent evidence dock keeps every conclusion one click from its
// grounding (slide-over below lg so selection is never a silent no-op).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { PageSubHeader } from "@/components/shared/PageSubHeader";
import { QuestionRail } from "@/components/query/QuestionRail";
import { EvidenceDock } from "@/components/query/EvidenceDock";
import { VaultMemoUpload } from "@/components/query/VaultMemoUpload";
import { GraphCanvas } from "@/components/query/GraphCanvas";
import { RelativeValueTable } from "@/components/query/RelativeValueTable";
import { ScatterCanvas } from "@/components/query/ScatterCanvas";
import { LineageFlow } from "@/components/query/LineageFlow";
import { CitationViewer } from "@/components/command/CitationViewer";
import { useNotify } from "@/components/shared/Notifications";
import { acceptQueryLink, listQueryLinks, queryCapabilities, queryGraph, queryOverlay, queryRoute, retractQueryLink } from "@/lib/api";
import type { Capability, CapabilitiesResult, GraphResult, GraphNode, OverlayEdge, OverlayResult } from "@/lib/query/graph";
import { pairKey } from "@/lib/query/graph";
import { downloadQueryCsv } from "@/lib/query/export";
import { rankQueryCapabilities } from "@/lib/query/routing";
import { engineNote, questionFor, questionGroups } from "@/lib/query/questions";
import { coerceView, nativeView, viewsFor, VIEW_LABELS, type QueryView } from "@/lib/query/views";
import { synthesize } from "@/lib/query/synthesis";
import { MODEL_HUE } from "@/components/query/node-style";

export default function QueryPage() {
  return (
    <RequireAuth>
      <QueryWorkspace />
    </RequireAuth>
  );
}

// Auto-run preference: richest cross-issuer walks first, so the surface opens
// on a live answer, not an empty canvas.
const PREFER = ["peer-set", "contagion", "concentration-map", "scatter", "trace-source"];

type HistoryEntry = { text: string; capId: string; capLabel: string };

function QueryWorkspace() {
  const [caps, setCaps] = useState<CapabilitiesResult | null>(null);
  const [capsErr, setCapsErr] = useState<string | null>(null);
  const [graph, setGraph] = useState<GraphResult | null>(null);
  const [graphErr, setGraphErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [text, setText] = useState("");
  const [theme, setTheme] = useState(""); // free-text risk theme for the shared-theme walk
  const [note, setNote] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<Capability[]>([]);
  const [cite, setCite] = useState<{ id: string; label?: string | null } | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false); // sub-lg evidence slide-over
  const [overlay, setOverlay] = useState<OverlayResult | null>(null);
  const [overlayBusy, setOverlayBusy] = useState(false);
  // Analyst-ratified links (phase 3): pairKey → link id, drives ACCEPT/UNDO state.
  const [acceptedPairs, setAcceptedPairs] = useState<Map<string, string>>(new Map());
  const [view, setView] = useState<QueryView>("graph");
  const [searchOpen, setSearchOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const notify = useNotify();

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
    if (window.innerWidth < 1024) setCollapsed(true);
  }, []);

  // ⌘K routes here (AskProvider dispatches caos:query-focus on /query).
  useEffect(() => {
    const handleFocus = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("caos:query-focus", handleFocus);
    return () => window.removeEventListener("caos:query-focus", handleFocus);
  }, []);

  const capById = useMemo(() => {
    const m = new Map<string, Capability>();
    caps?.groups.forEach((g) => g.capabilities.forEach((c) => m.set(c.id, c)));
    return m;
  }, [caps]);
  const groups = useMemo(() => questionGroups(caps), [caps]);
  const totalCaps = capById.size;
  const totalReady = useMemo(
    () => [...capById.values()].filter((c) => c.enabled).length,
    [capById]
  );
  const activeCap = activeId ? capById.get(activeId) : null;

  const selectNode = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setSheetOpen(true);
  }, []);

  const runSeq = useRef(0);
  const run = useCallback((capId: string, capMode?: string, toast = false, themeArg?: string) => {
    // Ignore out-of-order results: a slow earlier queryGraph must not clobber a
    // newer one (graph/error/running guarded on the latest sequence).
    const seq = ++runSeq.current;
    setActiveId(capId);
    setRunning(true);
    setGraphErr(null);
    setNote(null);
    setSuggest([]);
    setSelectedNode(null);
    setSheetOpen(false);
    setOverlay(null); // model overlay belongs to ONE graph — never carries across runs
    // Every run opens on its native view — a leftover Scatter/Lineage from the
    // previous graph must never be the first render of a new one.
    if (capMode) setView(nativeView(capId, capMode));
    queryGraph(capId, undefined, themeArg)
      .then((g) => {
        if (seq !== runSeq.current) return;
        setGraph(g);
        setView(nativeView(g.capability_id, g.mode));
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

  const pick = useCallback((capId: string) => {
    run(capId, capById.get(capId)?.mode);
  }, [run, capById]);

  useEffect(() => {
    listQueryLinks()
      .then((r) => setAcceptedPairs(new Map(r.links.map((l) => [pairKey(l.issuer_a, l.issuer_b), l.id]))))
      .catch(() => {}); // read-only state seed; absence just means no UNDO markers
  }, []);

  // Re-fetch the current graph WITHOUT clearing the overlay — after a ratify the
  // deterministic payload now draws the solid accepted edge; the overlay stays up
  // so the analyst can accept several proposals in one sitting.
  const refreshGraph = useCallback(() => {
    if (!activeId) return;
    queryGraph(activeId, undefined, activeId === "shared-theme" ? theme : undefined)
      .then(setGraph).catch(() => {});
  }, [activeId, theme]);

  const acceptLink = useCallback((edge: OverlayEdge) => {
    if (!activeId) return;
    acceptQueryLink(edge, activeId, overlay?.model ?? null)
      .then((l) => {
        setAcceptedPairs((prev) => new Map(prev).set(pairKey(l.issuer_a, l.issuer_b), l.id));
        notify("Link ratified", `${edge.source} ⇢ ${edge.target} is now stored graph data`);
        refreshGraph();
      })
      .catch((e) => {
        const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          || (e as Error)?.message || "could not accept link";
        notify("Accept failed", String(d));
      });
  }, [activeId, overlay, notify, refreshGraph]);

  const retractLink = useCallback((linkId: string) => {
    retractQueryLink(linkId)
      .then(() => {
        setAcceptedPairs((prev) => {
          const next = new Map(prev);
          for (const [k, v] of next) if (v === linkId) next.delete(k);
          return next;
        });
        notify("Link retracted", "It will no longer be drawn");
        refreshGraph();
      })
      .catch((e) => {
        const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          || (e as Error)?.message || "could not retract link";
        notify("Retract failed", String(d));
      });
  }, [notify, refreshGraph]);

  // Load capabilities, then auto-run the first runnable preferred walk so the
  // surface opens on a live answer.
  useEffect(() => {
    let cancelled = false;
    queryCapabilities()
      .then((c) => {
        if (cancelled) return;
        setCaps(c);
        const flat = c.groups.flatMap((g) => g.capabilities);
        const enabled = new Map(flat.filter((x) => x.enabled).map((x) => [x.id, x]));
        const firstId = PREFER.find((id) => enabled.has(id)) || [...enabled.keys()][0];
        if (firstId) run(firstId, enabled.get(firstId)?.mode);
      })
      .catch((e) => {
        if (!cancelled) setCapsErr((e as Error)?.message || "could not load capabilities");
      });
    return () => { cancelled = true; };
  }, [run]);

  // Suggestions for the command-bar dropdown: the richest runnable walks.
  const prompts = useMemo(() => {
    const flat = caps?.groups.flatMap((g) => g.capabilities) ?? [];
    const enabled = flat.filter((c) => c.enabled);
    const preferred = PREFER.map((id) => enabled.find((c) => c.id === id)).filter(Boolean) as Capability[];
    const rest = enabled.filter((c) => !PREFER.includes(c.id));
    return [...preferred, ...rest].slice(0, 5);
  }, [caps]);

  // Keyword-route the free text to the best enabled walk; a miss or a greyed
  // best match surfaces the closest runnable walks as did-you-mean chips.
  const keywordSubmit = useCallback(() => {
    const q = text.trim().toLowerCase();
    if (!q) return;
    const allCaps = caps?.groups.flatMap((g) => g.capabilities) ?? [];
    const scored = rankQueryCapabilities(q, allCaps);
    const runnable = scored.filter((x) => x.c.enabled).map((x) => x.c);
    if (scored.length === 0) {
      setNote("No walk matched. Try one of these:");
      setSuggest(allCaps.filter((c) => c.enabled).slice(0, 4));
      return;
    }
    const best = scored[0].c;
    if (best.enabled) {
      addToHistory(text, best.id, best.label);
      run(best.id, best.mode, true);
      return;
    }
    setNote(`${best.label} — ${best.reason}. Runnable instead:`);
    setSuggest(runnable.slice(0, 4));
  }, [text, caps, run, addToHistory]);

  // Loud routing: prefer the LLM router (reasons shown, alternatives offered),
  // degrade to the keyword router on empty candidates or any failure — routing
  // never gets worse than the deterministic path.
  const submit = useCallback(() => {
    const q = text.trim();
    if (!q) return;
    setSearchOpen(false);
    if (!caps?.availability?.model_lane) {
      keywordSubmit();
      return;
    }
    setNote("Routing…");
    setSuggest([]);
    queryRoute(q)
      .then((r) => {
        if (r.candidates.length === 0) {
          keywordSubmit();
          return;
        }
        const top = r.candidates.find((c) => c.enabled) ?? r.candidates[0];
        const rest = r.candidates.filter((c) => c.id !== top.id);
        const restCaps = rest
          .map((c) => capById.get(c.id))
          .filter(Boolean) as Capability[];
        if (top.enabled) {
          addToHistory(q, top.id, top.label);
          run(top.id, capById.get(top.id)?.mode, true);
          setNote(`Routed: ${top.reason || top.label}${restCaps.length ? " · also:" : ""}`);
          setSuggest(restCaps);
        } else {
          setNote(`${top.label} — ${capById.get(top.id)?.reason ?? "unavailable"}. Runnable instead:`);
          setSuggest(restCaps.filter((c) => c.enabled));
        }
      })
      .catch(() => keywordSubmit());
  }, [text, caps, capById, keywordSubmit, run, addToHistory]);

  const views = graph ? viewsFor(graph.capability_id, graph.mode) : [];
  const activeView = graph ? coerceView(view, graph.capability_id, graph.mode) : view;

  // A ratified proposal is drawn solid by the deterministic graph — hide its
  // dashed twin (a stale cached overlay can still contain the pair).
  const visibleOverlayEdges = useMemo(() => {
    if (!overlay) return undefined;
    const drawn = new Set((graph?.edges ?? []).map((e) => pairKey(e.source, e.target)));
    return overlay.edges.filter((e) => !drawn.has(pairKey(e.source, e.target)));
  }, [overlay, graph]);

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
          <VaultMemoUpload
            onUploaded={() => {
              // New wikilinks may ungrey / repopulate the Wiki & Memos edge.
              queryCapabilities().then(setCaps).catch(() => {});
              if (activeId === "analyst-memos") pick("analyst-memos");
            }}
          />
          <MetricPill label="answerable" value={caps ? `${totalReady}/${totalCaps}` : "loading"} />
          {activeCap && <MetricPill label="active" value={questionFor(activeCap)} />}
          {running && <span className="tabular text-caos-2xs text-caos-accent caos-running">walking graph</span>}
        </div>
      </PageSubHeader>

      <div className="flex-1 min-h-0 flex bg-caos-bg">
        <QuestionRail
          groups={groups}
          activeId={activeId}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          onPick={pick}
        />

        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <section className="shrink-0 border-b border-caos-border bg-caos-panel/55 px-4 py-2.5 relative">
            <div className="flex items-center gap-2 bg-caos-bg border border-caos-border rounded-md px-3 py-1.5 focus-within:border-caos-accent/70 transition-caos">
              <QueryMark small />
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setSearchOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") setSearchOpen(false);
                }}
                placeholder={`Route a question across coverage — ${totalReady || "…"} walks ready`}
                aria-label="Query coverage"
                className="flex-1 bg-transparent outline-none tabular text-caos-md text-caos-text placeholder:text-caos-muted"
              />
              <span className="tabular text-caos-3xs text-caos-muted font-mono border border-caos-border rounded px-1 py-0.5 hidden sm:inline" aria-hidden>
                ⌘K
              </span>
              <button
                type="button"
                onClick={submit}
                className="tabular text-caos-sm px-3 py-0.5 rounded bg-caos-accent text-caos-bg font-medium hover:opacity-90 transition-caos focus-ring"
              >
                Run
              </button>
            </div>

            {searchOpen && (history.length > 0 || prompts.length > 0) && (
              <div className="absolute left-4 right-4 top-full -mt-1 z-20 bg-caos-panel border border-caos-border rounded-md overflow-hidden" style={{ boxShadow: "var(--shadow-pop)" }}>
                {history.length > 0 && (
                  <div className="py-1 border-b border-caos-border/60">
                    <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted px-3 py-1">Recent</div>
                    {history.slice(0, 3).map((h, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setText(h.text);
                          setSearchOpen(false);
                          pick(h.capId);
                        }}
                        className="w-full text-left px-3 py-1.5 flex items-baseline gap-2 hover:bg-caos-elevated/60 transition-caos focus-ring"
                      >
                        <span className="tabular text-caos-sm text-caos-text truncate">&quot;{h.text}&quot;</span>
                        <span className="tabular text-caos-3xs text-caos-muted font-mono shrink-0">→ {h.capLabel}</span>
                      </button>
                    ))}
                  </div>
                )}
                {prompts.length > 0 && (
                  <div className="py-1">
                    <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted px-3 py-1">Runnable now</div>
                    {prompts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSearchOpen(false);
                          addToHistory(questionFor(p), p.id, p.label);
                          pick(p.id);
                        }}
                        className="w-full text-left px-3 py-1.5 flex items-baseline gap-2 hover:bg-caos-elevated/60 transition-caos focus-ring"
                      >
                        <span className="tabular text-caos-sm text-caos-text truncate">{questionFor(p)}</span>
                        <span className="tabular text-caos-3xs text-caos-muted font-mono shrink-0 truncate max-w-[45%]">{engineNote(p.id)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                    onClick={() => pick(c.id)}
                    className="tabular text-caos-2xs px-2 py-0.5 rounded border border-caos-accent/50 text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </section>

          {graph && (
            <div className="shrink-0 px-4 py-3 border-b border-caos-border bg-caos-panel">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="tabular text-caos-3xs uppercase tracking-wide text-caos-accent border border-caos-accent/40 bg-caos-accent/10 rounded px-1.5 py-px">
                  {graph.mode}
                </span>
                {activeCap && (
                  <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted">{questionFor(activeCap)}</span>
                )}
                {running && <span className="tabular text-caos-2xs text-caos-muted caos-running">running</span>}
              </div>
              <h2 className="tabular text-caos-xl text-caos-text font-semibold mt-1 truncate">{graph.title}</h2>
              <p className="text-caos-md text-caos-text font-sans leading-normal mt-1">{synthesize(graph)}</p>
              {activeId && (
                <div className="tabular text-caos-3xs text-caos-muted font-mono mt-1">{engineNote(activeId)}</div>
              )}
              {activeId === "shared-theme" && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <label htmlFor="shared-theme-input" className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted shrink-0">
                    Risk theme
                  </label>
                  <div className="flex items-center gap-1.5 bg-caos-bg border border-caos-border rounded px-2 py-1 focus-within:border-caos-accent/70 transition-caos min-w-0">
                    <input
                      id="shared-theme-input"
                      value={theme}
                      maxLength={200}
                      onChange={(e) => setTheme(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && theme.trim()) run("shared-theme", activeCap?.mode, false, theme.trim());
                      }}
                      placeholder="e.g. tariff exposure, refinancing wall, FX translation"
                      aria-label="Risk theme to overlay across coverage"
                      className="min-w-[12rem] flex-1 bg-transparent outline-none tabular text-caos-sm text-caos-text placeholder:text-caos-muted"
                    />
                    <button
                      type="button"
                      onClick={() => theme.trim() && run("shared-theme", activeCap?.mode, false, theme.trim())}
                      disabled={!theme.trim() || running}
                      className="tabular text-caos-2xs uppercase tracking-wider px-2 py-0.5 rounded bg-caos-accent text-caos-bg font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-caos focus-ring shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {graph ? (
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b border-caos-border bg-caos-bg flex-wrap">
              <div className="flex border border-caos-border rounded bg-caos-panel/40 p-0.5" role="tablist" aria-label="Result view">
                {views.map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={activeView === v}
                    onClick={() => setView(v)}
                    className={`tabular text-caos-3xs uppercase tracking-wider px-2 py-0.5 rounded transition-caos cursor-pointer font-mono ${
                      activeView === v
                        ? "bg-caos-accent text-caos-bg font-semibold"
                        : "text-caos-muted hover:text-caos-text hover:bg-caos-elevated/40"
                    }`}
                  >
                    {VIEW_LABELS[v]}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSheetOpen((v) => !v)}
                  className="lg:hidden tabular text-caos-xs px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring"
                >
                  EVIDENCE
                </button>
                {caps?.availability?.model_lane && activeId && (
                  <button
                    type="button"
                    disabled={overlayBusy}
                    onClick={() => {
                      if (overlay) {
                        setOverlay(null);
                        return;
                      }
                      setOverlayBusy(true);
                      queryOverlay(activeId)
                        .then((o) => {
                          setOverlay(o);
                          notify("Model overlay ready", `${o.edges.length} proposed link${o.edges.length === 1 ? "" : "s"}${o.cached ? " (cached)" : ""}`);
                        })
                        .catch((e) => {
                          const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                            || (e as Error)?.message || "model overlay failed";
                          notify("Model overlay failed", String(d));
                        })
                        .finally(() => setOverlayBusy(false));
                    }}
                    className={`tabular text-caos-xs px-2 py-1 rounded border transition-caos focus-ring ${
                      overlay
                        ? "font-semibold"
                        : "text-caos-muted hover:text-caos-text border-caos-border"
                    } ${overlayBusy ? "opacity-60 cursor-wait" : ""}`}
                    style={overlay ? { color: MODEL_HUE, borderColor: MODEL_HUE, backgroundColor: `${MODEL_HUE}15` } : undefined}
                    title="Model-proposed links + commentary over this graph — labeled, cite-gated, excluded from print/CSV"
                  >
                    {overlayBusy ? "ANALYZING…" : overlay ? "MODEL OVERLAY ON" : "MODEL OVERLAY"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => downloadQueryCsv(graph)}
                  className="tabular text-caos-xs px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring"
                >
                  EXPORT CSV
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="tabular text-caos-xs px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring"
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
              <Center text={running ? "Walking the graph…" : "Pick a question to render its answer."} />
            ) : activeView === "rv" ? (
              <RelativeValueTable
                graph={graph}
                selectedNodeId={selectedNode?.id}
                onSelectNode={selectNode}
              />
            ) : activeView === "scatter" ? (
              <ScatterCanvas
                graph={graph}
                selectedNodeId={selectedNode?.id}
                onSelectNode={selectNode}
              />
            ) : activeView === "trace" ? (
              <LineageFlow
                graph={graph}
                selectedNodeId={selectedNode?.id}
                onSelectNode={selectNode}
              />
            ) : (
              <GraphCanvas
                graph={graph}
                overlay={visibleOverlayEdges}
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

        <aside
          className="hidden lg:flex w-[300px] xl:w-[340px] border-l border-caos-border bg-caos-panel flex-col shrink-0"
          aria-label="Evidence"
        >
          <EvidenceDock
            graph={graph}
            node={selectedNode}
            overlay={overlay}
            acceptedPairs={acceptedPairs}
            onClear={() => setSelectedNode(null)}
            onOpenChunk={(id, label) => setCite({ id, label })}
            onPickWalk={pick}
            onAcceptLink={acceptLink}
            onRetractLink={retractLink}
          />
        </aside>
      </div>

      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-overlay flex justify-end" role="dialog" aria-label="Evidence">
          <button
            type="button"
            aria-label="Close evidence panel"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-[#050507]/60"
          />
          <div className="relative w-[320px] max-w-[90vw] h-full bg-caos-panel border-l border-caos-border flex flex-col caos-enter">
            <EvidenceDock
              graph={graph}
              node={selectedNode}
              overlay={overlay}
              acceptedPairs={acceptedPairs}
              onClear={() => setSheetOpen(false)}
              onOpenChunk={(id, label) => setCite({ id, label })}
              onPickWalk={pick}
              onAcceptLink={acceptLink}
              onRetractLink={retractLink}
            />
          </div>
        </div>
      )}

      {cite && <CitationViewer chunkId={cite.id} label={cite.label} onClose={() => setCite(null)} />}
    </div>
  );
}

function QueryMark({ small = false }: { small?: boolean }) {
  const size = small ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <span className={`${size} shrink-0 rounded-sm border border-caos-accent/70 bg-caos-accent/15 text-caos-accent flex items-center justify-center`} aria-hidden="true">
      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 stroke-current" fill="none" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="5" cy="5" r="3" />
        <path d="M7.5 7.5 L10 10" />
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

function Center({ text, warn }: { text: string; warn?: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-6">
      <div className={"tabular text-caos-xl max-w-md " + (warn ? "text-caos-warning" : "text-caos-muted")}>{text}</div>
    </div>
  );
}
