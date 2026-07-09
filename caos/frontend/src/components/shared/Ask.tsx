"use client";

// Global "Ask" launcher — one entry point to the conversational surface, scoped
// by where the analyst is. ⌘K / Ctrl+K toggles it from anywhere (Esc closes).
// On the issuer-scoped concepts (Deep-Dive, Model) it opens the ATLF issuer Q&A;
// elsewhere it opens the cross-issuer NL query. Deep-Dive owns its own
// evidence-synced chat (rendered inside its EvidenceSyncProvider) and only reads
// `open` from this context, so the launcher never double-mounts a chat there.

import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import { CloseButton } from "@/components/shared/CloseButton";
import { usePathname } from "next/navigation";
import { IssuerChat } from "@/components/deepdive/IssuerChat";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { useAuth } from "@/components/shared/AuthProvider";
import { queryCapabilities, queryGraph } from "@/lib/api";
import { sevSurface } from "@/lib/pipeline/sev";
import { GraphCanvas } from "@/components/query/GraphCanvas";
import { RelativeValueTable } from "@/components/query/RelativeValueTable";
import { ScatterCanvas } from "@/components/query/ScatterCanvas";
import { LineageFlow } from "@/components/query/LineageFlow";
import { CitationViewer } from "@/components/command/CitationViewer";
import { downloadQueryCsv } from "@/lib/query/export";
import type { Capability, CapabilitiesResult, GraphResult, GraphNode } from "@/lib/query/graph";
import { ANALYST_MEMO_PROMPT, rankQueryCapabilities } from "@/lib/query/routing";
import { nativeView, viewsFor, VIEW_LABELS, type QueryView } from "@/lib/query/views";
import { ModalBackdrop } from "@/components/shared/ModalBackdrop";

export type QueryPrompt = { id: string; text: string; sub: string };

interface AskCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}

const Ctx = createContext<AskCtx>({ open: false, setOpen: () => {}, toggle: () => {} });

export const useAsk = () => useContext(Ctx);

const PROMPTS_BY_CONCEPT: Record<string, QueryPrompt[]> = {
  command: [
    { id: "peer-set", text: "Map today's closest credit peers", sub: "issuer graph · CP-1C" },
    { id: "scatter", text: "Plot leverage × coverage for coverage", sub: "cross-issuer scatter" },
    { id: "open-findings", text: "Show open QA findings", sub: "governance" },
    { id: "trace-source", text: "Trace an IC verdict to its sources", sub: "provenance walk" },
    { id: "concentration-map", text: "Cluster coverage by sector", sub: "sector clusters" },
  ],
  monitor: [
    { id: "open-findings", text: "Surface live QA exceptions", sub: "governance" },
    { id: "coverage-completeness", text: "Find coverage gaps", sub: "coverage health" },
    { id: "impact-analysis", text: "Map affected downstream conclusions", sub: "impact analysis" },
    { id: "lineage-audit", text: "Audit stale lineage", sub: "provenance" },
  ],
  research: [
    { id: "shared-theme", text: "Find repeated themes across notes", sub: "semantic theme walk" },
    { id: "trace-source", text: "Trace research claims to sources", sub: "provenance walk" },
    { id: "orphan-claims", text: "Show ungrounded claims", sub: "QA" },
    { id: "committee-board", text: "Build the committee question board", sub: "IC prep" },
    { id: "debate-digest", text: "Digest competing credit arguments", sub: "research synthesis" },
  ],
  pipeline: [
    { id: "coverage-completeness", text: "Find missing pipeline coverage", sub: "coverage health" },
    { id: "gate-lane", text: "Show items blocked at gates", sub: "workflow lane" },
    { id: "impact-analysis", text: "Map downstream impact of a blocker", sub: "impact analysis" },
    { id: "open-findings", text: "List QA findings by issuer", sub: "governance" },
  ],
  deepdive: [
    { id: "trace-source", text: "Trace this issuer's verdict to sources", sub: "provenance walk" },
    { id: "peer-set", text: "Map comparable issuers", sub: "issuer graph · CP-1C" },
    { id: "metric-trend", text: "Show metric trend context", sub: "time series" },
    { id: "tension", text: "Find tensions in the credit view", sub: "debate" },
    { id: "open-findings", text: "Show open QA findings", sub: "governance" },
  ],
  model: [
    { id: "metric-trend", text: "Show historical model drivers", sub: "time series" },
    { id: "scatter", text: "Plot leverage × coverage by issuer", sub: "cross-issuer scatter" },
    { id: "impact-analysis", text: "Map scenario impact", sub: "impact analysis" },
    { id: "distribution", text: "Rank issuers by downside pressure", sub: "distribution" },
    { id: "trace-source", text: "Trace model inputs to sources", sub: "provenance walk" },
  ],
  reports: [
    { id: "orphan-claims", text: "Find report claims without support", sub: "QA" },
    { id: "trace-source", text: "Trace report verdicts to evidence", sub: "provenance walk" },
    { id: "committee-board", text: "Build committee questions", sub: "IC prep" },
    { id: "debate-digest", text: "Digest the credit debate", sub: "research synthesis" },
    { id: "open-findings", text: "Show open report QA findings", sub: "governance" },
  ],
  query: [
    { id: "peer-set", text: "Map peers by credit profile", sub: "issuer graph · CP-1C" },
    { id: "contagion", text: "Co-move under an energy shock", sub: "contagion overlay · CP-2" },
    { id: "concentration-map", text: "Cluster coverage by sector", sub: "sector clusters" },
    { id: "scatter", text: "Plot leverage × coverage", sub: "cross-issuer scatter" },
    { id: "trace-source", text: "Trace the IC verdict to its sources", sub: "provenance walk" },
    ANALYST_MEMO_PROMPT,
  ],
  "sector-rv": [
    { id: "peer-set", text: "Map RV tails to closest credit peers", sub: "issuer graph · CP-1C" },
    { id: "scatter", text: "Plot RV names against leverage and coverage", sub: "cross-issuer scatter" },
    { id: "distribution", text: "Rank downside pressure in this sector", sub: "distribution" },
    { id: "trace-source", text: "Trace RV conclusions to evidence", sub: "provenance walk" },
    { id: "debate-digest", text: "Digest the relative-value debate", sub: "research synthesis" },
  ],
};

export function AskProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "";
  useEffect(() => {
    // fallow-ignore-next-line complexity
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (pathname.startsWith("/query")) {
          window.dispatchEvent(new Event("caos:query-focus"));
        } else {
          setOpen((v) => !v);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onAskToggle = () => {
      if (pathname.startsWith("/query")) {
        window.dispatchEvent(new Event("caos:query-focus"));
      } else {
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("caos:ask-toggle", onAskToggle);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("caos:ask-toggle", onAskToggle);
    };
  }, [pathname]);
  const value = useMemo(() => ({ open, setOpen, toggle: () => setOpen((v) => !v) }), [open]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Where the conversation is scoped. Deep-Dive is split out because it renders
// its own evidence-aware chat from `open`.
function scopeFor(pathname: string): "deepdive" | "issuer" | "cross" {
  if (pathname.startsWith("/deepdive")) return "deepdive";
  if (pathname.startsWith("/model") || pathname.startsWith("/pipeline") || pathname.startsWith("/issuers/profile"))
    return "issuer";
  return "cross";
}

function conceptFor(pathname: string): keyof typeof PROMPTS_BY_CONCEPT {
  const first = pathname.split("/").filter(Boolean)[0] || "command";
  return first in PROMPTS_BY_CONCEPT ? (first as keyof typeof PROMPTS_BY_CONCEPT) : "query";
}

// fallow-ignore-next-line complexity
export function AskLauncher() {
  const { open, setOpen, toggle } = useAsk();
  const { user, needsLogin } = useAuth();
  const pathname = usePathname() || "";
  const scope = scopeFor(pathname);

  // Close on navigation — the overlay is transient, so changing concept
  // shouldn't carry a stale Ask (or pop the wrong-scope surface on arrival).
  useEffect(() => { setOpen(false); }, [pathname, setOpen]);

  // Gate on a signed-in profile: Ask queries need an analyst identity, and the
  // launcher must not float over the login landing (it sits in the root layout,
  // outside RequireAuth). Loading/error/needs-login all resolve to "not ready".
  if (!user || needsLogin) return null;

  if (pathname.startsWith("/query")) return null;

  // Floating trigger, hidden while open. Deep-Dive also has an in-panel ASK
  // button, but this keeps ⌘K discoverable everywhere.
  const trigger = !open ? (
    <button
      onClick={toggle}
      title="Ask CAOS (Alt+K / ⌘K) — cross-issuer query, or issuer Q&A in Deep-Dive / Model"
      className="fixed bottom-3 right-3 z-overlay flex items-center gap-1.5 tabular text-caos-md px-2.5 py-1.5 rounded-full border border-caos-accent/60 bg-caos-panel text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
      style={{ boxShadow: "var(--shadow-pop)" }}
    >
      <AskMark /> Ask
      <span className="tabular text-caos-2xs px-1 rounded border border-caos-border">Alt+K</span>
    </button>
  ) : null;

  // Deep-Dive renders its own chat from `open`; the launcher only supplies the trigger.
  if (scope === "deepdive") return trigger;
  if (!open) return trigger;

  // Model and other issuer-scoped concepts → the ATLF issuer Q&A slide-over.
  // No specific module is in view from this generic launcher, so pass an empty
  // tab: IssuerChat then omits the "currently viewing <module>" line instead of
  // asserting a fabricated one (was hardcoded "M-118" on every route — N4).
  if (scope === "issuer") {
    return <>{trigger}<IssuerChat tab="" onClose={() => setOpen(false)} /></>;
  }

  // Everywhere else → the cross-issuer NL query, as a centered modal.
  return <AskModal pathname={pathname} onClose={() => setOpen(false)} />;
}

// Cross-issuer NL query — a true modal (backdrop + centered panel), so it gets
// focus-trap / restore / scroll-lock + dialog semantics via useModalA11y.
function AskModal({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  const concept = conceptFor(pathname);

  const [caps, setCaps] = useState<CapabilitiesResult | null>(null);
  const [capsErr, setCapsErr] = useState<string | null>(null);
  const [graph, setGraph] = useState<GraphResult | null>(null);
  const [graphErr, setGraphErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<Capability[]>([]);
  const [cite, setCite] = useState<{ id: string; label?: string | null } | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [layout, setLayout] = useState<QueryView>("graph");

  const capById = useMemo(() => {
    const m = new Map<string, { label: string; enabled: boolean; reason: string | null }>();
    caps?.groups.forEach((g) => g.capabilities.forEach((c) => m.set(c.id, c)));
    return m;
  }, [caps]);

  // Load capabilities on mount so keyword mapping and suggestions work, but do NOT auto-run anything.
  useEffect(() => {
    let cancelled = false;
    queryCapabilities()
      .then((c) => {
        if (!cancelled) setCaps(c);
      })
      .catch((e) => {
        if (!cancelled) setCapsErr((e as Error)?.message || "could not load capabilities");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const prompts = useMemo(() => {
    const promptSet = PROMPTS_BY_CONCEPT[concept] || [];
    return promptSet.filter((p) => capById.get(p.id)?.enabled).slice(0, 4);
  }, [capById, concept]);

  const runSeq = useRef(0);
  const run = useCallback((capId: string) => {
    const seq = ++runSeq.current;
    setHasQueried(true);
    setRunning(true);
    setGraphErr(null);
    setNote(null);
    setSuggest([]);
    setSelectedNode(null);
    setReaderOpen(false);

    queryGraph(capId)
      .then((g) => {
        if (seq !== runSeq.current) return;
        setGraph(g);
        // Every run opens on its native view — a leftover Scatter/Lineage from
        // the previous graph must never be the first render of a new one.
        setLayout(nativeView(g.capability_id, g.mode));
      })
      .catch((e) => {
        if (seq !== runSeq.current) return;
        const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          || (e as Error)?.message || "could not run query";
        setGraphErr(String(d));
      })
      .finally(() => {
        if (seq === runSeq.current) setRunning(false);
      });
  }, []);

  const submit = useCallback(() => {
    const q = text.trim().toLowerCase();
    if (!q) return;
    const allCaps = caps?.groups.flatMap((g) => g.capabilities) ?? [];
    const scored = rankQueryCapabilities(q, allCaps);

    const runnable = scored.filter((x) => x.c.enabled).map((x) => x.c);
    if (scored.length === 0) {
      setHasQueried(true);
      setNote("No capability matched. Try one of these:");
      setSuggest(allCaps.filter((c) => c.enabled).slice(0, 4));
      return;
    }
    const best = scored[0].c;
    if (best.enabled) {
      run(best.id);
      return;
    }
    setHasQueried(true);
    setNote(`${best.label} — ${best.reason}. Runnable instead:`);
    setSuggest(runnable.slice(0, 4));
  }, [text, caps, run]);

  return (
    <ModalBackdrop onClose={onClose} layout="justify-end" className="transition-opacity duration-200">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ask with Query"
        onClick={(e) => e.stopPropagation()}
        className={`caos-enter bg-caos-panel border-l border-caos-border h-full w-full transition-all duration-300 flex flex-col overflow-hidden shadow-2xl ${
          hasQueried
            ? "max-w-4xl"
            : "max-w-md p-4 gap-3.5"
        }`}
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        {!hasQueried ? (
          /* Compact initial layout */
          <>
            <div className="flex items-center justify-between pb-1.5 border-b border-caos-border/50">
              <div className="flex items-center gap-2">
                <AskMark />
                <span className="tabular text-caos-xs text-caos-muted uppercase tracking-wider font-mono">Ask CAOS</span>
              </div>
              <CloseButton onClick={onClose} title="Close (Esc)" />
            </div>

            <div className="flex items-center gap-2 bg-caos-elevated border border-caos-border rounded px-3 py-2 focus-within:border-caos-accent/70 transition-caos">
              <AskMark />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="Ask across coverage — e.g. Map peers by credit profile"
                aria-label="Query coverage"
                className="flex-1 bg-transparent outline-none tabular text-caos-md text-caos-text placeholder:text-caos-muted"
                autoFocus
              />
              <button
                onClick={submit}
                className="tabular text-caos-xs px-3 py-1 rounded bg-caos-accent text-caos-bg font-medium hover:opacity-90 transition-caos focus-ring"
              >
                Run
              </button>
            </div>

            {prompts.length > 0 && (
              <div className="mt-1 flex flex-col gap-2">
                <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted font-mono">
                  Suggested queries
                </div>
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                  {prompts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => run(p.id)}
                      className="text-left bg-caos-elevated border border-caos-border hover:border-caos-accent/50 rounded p-2 transition-caos focus-ring flex flex-col justify-between h-full cursor-pointer"
                    >
                      <span className="tabular text-caos-sm text-caos-text leading-tight">{p.text}</span>
                      <span className="tabular text-caos-3xs text-caos-muted font-mono mt-1">→ {p.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Expanded query output layout */
          <>
            {/* Top search bar area */}
            <div className="flex items-center gap-3 p-3 border-b border-caos-border bg-caos-elevated/70 shrink-0">
              <button
                onClick={() => {
                  setHasQueried(false);
                  setGraph(null);
                  setGraphErr(null);
                  setNote(null);
                  setSuggest([]);
                  setText("");
                }}
                title="Back to search"
                className="text-caos-muted hover:text-caos-text text-caos-xs px-2.5 py-1 rounded border border-caos-border bg-caos-panel font-mono uppercase tracking-wider transition-caos cursor-pointer"
              >
                ← Back
              </button>
              <div className="flex-1 flex items-center gap-2 bg-caos-panel border border-caos-border rounded px-2.5 py-1 focus-within:border-caos-accent/70 transition-caos">
                <AskMark />
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  placeholder="Type your query..."
                  aria-label="Query coverage"
                  className="flex-1 bg-transparent outline-none tabular text-caos-md text-caos-text placeholder:text-caos-muted"
                />
                <button
                  onClick={submit}
                  className="tabular text-caos-xs px-2.5 py-0.5 rounded bg-caos-accent text-caos-bg font-medium hover:opacity-90 transition-caos focus-ring"
                >
                  Run
                </button>
              </div>
              <div className="h-6 w-px bg-caos-border" />
              <CloseButton onClick={onClose} title="Close (Esc)" />
            </div>

            {/* Content body area */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Main graph panel */}
              <main className="flex-1 min-w-0 min-h-0 flex flex-col p-4 gap-3 overflow-hidden">
                {note && (
                  <div className="-mt-1 flex items-center gap-2 flex-wrap">
                    <span className="tabular text-caos-sm text-caos-warning">{note}</span>
                    {suggest.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => run(c.id)}
                        className="tabular text-caos-2xs px-2 py-0.5 rounded border border-caos-accent/50 text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring cursor-pointer"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}

                {graph && !graphErr && (
                  <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="tabular text-caos-3xs uppercase tracking-wide text-caos-accent border border-caos-accent/40 bg-caos-accent/10 rounded px-1.5 py-px">
                        {graph.mode}
                      </span>
                      <span className="tabular text-caos-md text-caos-text">{graph.title}</span>
                      {running && <span className="tabular text-caos-2xs text-caos-muted caos-running">running…</span>}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Layout switcher — only the views valid for this graph shape */}
                      <div className="flex border border-caos-border rounded bg-caos-panel/40 p-0.5">
                        {viewsFor(graph.capability_id, graph.mode).map((v) => (
                          <button
                            key={v}
                            onClick={() => setLayout(v)}
                            className={`tabular text-caos-3xs uppercase tracking-wider px-2 py-0.5 rounded transition-caos cursor-pointer font-mono ${
                              layout === v
                                ? "bg-caos-accent text-caos-bg font-semibold"
                                : "text-caos-muted hover:text-caos-text hover:bg-caos-elevated/40"
                            }`}
                          >
                            {VIEW_LABELS[v]}
                          </button>
                        ))}
                      </div>

                      <div className="h-4 w-px bg-caos-border hidden sm:block" />

                      {graph.meta.map((m, i) => (
                        <span key={i} className="tabular text-caos-2xs text-caos-muted font-mono whitespace-nowrap hidden sm:inline">
                          {m}
                          {i < graph.meta.length - 1 ? " ·" : ""}
                        </span>
                      ))}

                      <div className="flex gap-1.5 ml-2">
                        <button
                          onClick={() => downloadQueryCsv(graph)}
                          className="tabular text-caos-xs px-2 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos cursor-pointer"
                        >
                          CSV
                        </button>
                        <button
                          onClick={() => window.print()}
                          className="tabular text-caos-xs px-2 py-0.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos cursor-pointer"
                        >
                          PDF
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex-1 min-h-0 flex flex-col bg-caos-bg border border-caos-border rounded-md p-2 relative">
                  {capsErr ? (
                    <div className="flex-1 flex items-center justify-center text-center px-6">
                      <div className="tabular text-caos-md text-caos-warning">Couldn&apos;t load capabilities — {capsErr}</div>
                    </div>
                  ) : graphErr ? (
                    <div className="flex-1 flex items-center justify-center text-center px-6">
                      <div className="tabular text-caos-md text-caos-warning">Query failed — {graphErr}</div>
                    </div>
                  ) : running && !graph ? (
                    <div className="flex-1 flex items-center justify-center text-center px-6">
                      <div className="tabular text-caos-md text-caos-muted caos-running">Walking the graph…</div>
                    </div>
                  ) : !graph ? (
                    <div className="flex-1 flex items-center justify-center text-center px-6">
                      <div className="tabular text-caos-md text-caos-muted">Submit a query to view results.</div>
                    </div>
                  ) : layout === "rv" ? (
                    <RelativeValueTable
                      graph={graph}
                      selectedNodeId={selectedNode?.id}
                      onSelectNode={(node) => {
                        setSelectedNode(node);
                        setReaderOpen(true);
                      }}
                    />
                  ) : layout === "scatter" ? (
                    <ScatterCanvas
                      graph={graph}
                      selectedNodeId={selectedNode?.id}
                      onSelectNode={(node) => {
                        setSelectedNode(node);
                        setReaderOpen(true);
                      }}
                    />
                  ) : layout === "trace" ? (
                    <LineageFlow
                      graph={graph}
                      selectedNodeId={selectedNode?.id}
                      onSelectNode={(node) => {
                        setSelectedNode(node);
                        setReaderOpen(true);
                      }}
                    />
                  ) : (
                    <GraphCanvas
                      graph={graph}
                      onOpenChunk={(id, label) => setCite({ id, label })}
                      onSelectNode={(node) => {
                        setSelectedNode(node);
                        setReaderOpen(true);
                      }}
                    />
                  )}
                </div>

                {graph && graph.caveats.length > 0 && (
                  <div className="tabular text-caos-3xs text-caos-muted font-mono flex items-start gap-1.5 shrink-0">
                    <span aria-hidden>ⓘ</span>
                    <span>{graph.caveats.join(" · ")}</span>
                  </div>
                )}
              </main>

              {/* Split-Screen Reader Panel */}
              {readerOpen && selectedNode && (
                <aside
                  className="w-[380px] border-l border-caos-border bg-caos-panel flex flex-col p-4 gap-4 overflow-y-auto shrink-0 relative transition-caos"
                  aria-label="Node detail reader"
                >
                  <div className="flex items-start justify-between pb-2 border-b border-caos-border">
                    <div>
                      <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-accent font-mono">
                        {selectedNode.kind.replace("-", " ")}
                      </span>
                      <h2 className="tabular text-caos-md font-mono text-caos-text mt-0.5 leading-snug break-all">
                        {selectedNode.label}
                      </h2>
                    </div>
                    <button
                      onClick={() => setReaderOpen(false)}
                      className="text-caos-muted hover:text-caos-text text-caos-xl font-bold px-1.5 focus-ring cursor-pointer"
                      aria-label="Close panel"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="flex-1 flex flex-col gap-3 min-h-0">
                    {selectedNode.sub && (
                      <div>
                        <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-0.5">Description</div>
                        <div className="text-caos-sm text-caos-text leading-relaxed font-sans">{selectedNode.sub}</div>
                      </div>
                    )}

                    {selectedNode.title && (
                      <div>
                        <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-0.5">Summary / Detail</div>
                        <div className="text-caos-xs text-caos-text/90 leading-relaxed bg-caos-bg/50 border border-caos-border rounded p-2 font-mono whitespace-pre-wrap">
                          {selectedNode.title}
                        </div>
                      </div>
                    )}

                    {selectedNode.group && (
                      <div>
                        <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-0.5">Category Group</div>
                        <span className="tabular text-caos-3xs text-caos-text bg-caos-bg border border-caos-border rounded px-1.5 py-0.5 inline-block">
                          {selectedNode.group}
                        </span>
                      </div>
                    )}

                    {selectedNode.confidence && (
                      <div>
                        <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-0.5">Confidence</div>
                        <span
                          className="tabular text-caos-3xs font-semibold px-2 py-0.5 rounded border"
                          style={sevSurface(selectedNode.confidence === "High" ? "ok" : "warning", { border: 33, wash: 7 })}
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
                </aside>
              )}
            </div>
          </>
        )}
      </div>

      {cite && <CitationViewer chunkId={cite.id} label={cite.label} onClose={() => setCite(null)} />}
    </ModalBackdrop>
  );
}

function AskMark({ small = false }: { small?: boolean }) {
  const size = small ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <span className={`${size} shrink-0 rounded-sm border border-caos-accent/70 bg-caos-accent/15 text-caos-accent flex items-center justify-center`} aria-hidden="true">
      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 stroke-current" fill="none" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 6h8M6 2v8" />
      </svg>
    </span>
  );
}
