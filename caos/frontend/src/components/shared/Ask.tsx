"use client";

// Global "Ask" launcher — one entry point to the conversational surface, scoped
// by where the analyst is. Alt+K (or the ⌘K palette's Ask row) opens it; Esc closes.
// On the issuer-scoped concepts (Deep-Dive, Model) it opens the ATLF issuer Q&A;
// elsewhere it opens the cross-issuer NL query. Deep-Dive owns its own
// evidence-synced chat (rendered inside its EvidenceSyncProvider) and only reads
// `open` from this context, so the launcher never double-mounts a chat there.

import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import { CloseButton } from "@/components/shared/CloseButton";
import { usePathname, useSearchParams } from "next/navigation";
import { ModalBackdrop } from "@/components/shared/ModalBackdrop";
import { IssuerChat } from "@/components/deepdive/IssuerChat";
import { useLiveRun } from "@/lib/engine/useLiveRun";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import { getIssuer, queryCapabilities, toErrorMessage } from "@/lib/api";
import { useModalA11y, hasOpenModalA11yOverlay } from "@/lib/use-modal-a11y";
import { useAuth } from "@/components/shared/AuthProvider";
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
import { analysisApi, useAnalysisContext, type QueryRun } from "@/lib/analysis-workbench";

export type QueryPrompt = { id: string; text: string; sub: string };

interface AskCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  /** Open Ask with optional prefilled text — used by the ⌘K palette's
      "Ask CAOS" passthrough row so typed text is never lost. */
  openWith: (prefill?: string) => void;
  /** One-shot prefill consumed by AskModal on open. */
  prefill: string | null;
}

const Ctx = createContext<AskCtx>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
  openWith: () => {},
  prefill: null,
});

export const useAsk = () => useContext(Ctx);

const PROMPTS_BY_CONCEPT: Record<string, QueryPrompt[]> = {
  command: [
    { id: "peer-set", text: "Map today's closest credit peers", sub: "issuer graph · CP-1C" },
    { id: "scatter", text: "Plot leverage × interest coverage across covered names", sub: "cross-issuer scatter" },
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
  const [prefill, setPrefill] = useState<string | null>(null);
  const pathname = usePathname() || "";
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // One toggle for the Ask entry points (Alt+K via ConceptHotkeys and the
  // header Ask button): the same gesture must do the same thing — on /query it
  // focuses the query bar, else it toggles the modal. ⌘K/Ctrl+K now belongs to
  // the global command palette (CommandPalette.tsx), whose "Ask CAOS" row
  // routes back here through openWith() — muscle-memory text is preserved.
  const openWith = useCallback((text?: string) => {
    if (pathRef.current.startsWith("/query")) {
      // Carry the typed text through — a bare Event has no payload, so
      // ⌘K → type a question → Enter on /query used to focus (nothing,
      // actually — see below) an empty composer and silently drop the
      // question the analyst just typed.
      window.dispatchEvent(new CustomEvent("caos:query-focus", { detail: { text } }));
      return;
    }
    window.dispatchEvent(new CustomEvent("caos:modal-open", { detail: { owner: "ask" } }));
    setPrefill(text ?? null);
    setOpen(true);
  }, []);

  useEffect(() => {
    const fire = () => {
      if (pathname.startsWith("/query")) {
        window.dispatchEvent(new Event("caos:query-focus"));
      } else {
        if (!open) window.dispatchEvent(new CustomEvent("caos:modal-open", { detail: { owner: "ask" } }));
        setOpen(!open);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      // AskModal (and anything opened over it, e.g. a citation viewer) is
      // itself a useModalA11y-tracked overlay whose own topmost-gated
      // handler already owns Escape correctly. This coordinator-level
      // listener exists for the inline issuer-scoped Ask panel, which isn't
      // a useModalA11y dialog — defer whenever a tracked overlay is open so
      // this doesn't fire in parallel and collapse the wrong layer.
      if (e.key === "Escape" && !hasOpenModalA11yOverlay()) setOpen(false);
    };
    const onAskToggle = () => fire();
    const onModalOpen = (event: Event) => {
      if ((event as CustomEvent<{ owner?: string }>).detail?.owner !== "ask") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("caos:ask-toggle", onAskToggle);
    window.addEventListener("caos:modal-open", onModalOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("caos:ask-toggle", onAskToggle);
      window.removeEventListener("caos:modal-open", onModalOpen);
    };
  }, [pathname, open]);

  // Clear the one-shot prefill when Ask closes so a later plain open is clean.
  useEffect(() => {
    if (!open) setPrefill(null);
  }, [open]);

  const setOpenCoordinated = useCallback((next: boolean) => {
    if (next) window.dispatchEvent(new CustomEvent("caos:modal-open", { detail: { owner: "ask" } }));
    setOpen(next);
  }, []);

  const toggle = useCallback(() => {
    if (!open) window.dispatchEvent(new CustomEvent("caos:modal-open", { detail: { owner: "ask" } }));
    setOpen(!open);
  }, [open]);

  const value = useMemo(
    () => ({ open, setOpen: setOpenCoordinated, toggle, openWith, prefill }),
    [open, setOpenCoordinated, toggle, openWith, prefill],
  );
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

// Issuer-scoped Ask: resolves the issuer from the route and grounds IssuerChat in
// that issuer's OWN live run. For the reference deal it passes live=undefined so the
// chat keeps the ATLF showcase fixtures; for a real issuer it passes the live run, so
// the assistant answers from the issuer's own numbers (or the explicit "no run — don't
// use Atlas Forge" branch in caosChatContext) instead of fabricating Atlas Forge's
// figures. Split into its own component so useLiveRun is unconditional and only
// mounts when the issuer-scoped Ask is actually open.
function IssuerScopedAsk({ onClose }: { onClose: () => void }) {
  const searchParams = useSearchParams();
  const issuerId = searchParams?.get("issuer") || ATLF_REFERENCE_ISSUER_ID;
  const isReference = issuerId === ATLF_REFERENCE_ISSUER_ID;
  const live = useLiveRun(issuerId);
  const [issuerName, setIssuerName] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (isReference) { setIssuerName(undefined); return; }
    let stale = false;
    getIssuer(issuerId).then((d) => { if (!stale) setIssuerName(d.name); }).catch(() => {});
    return () => { stale = true; };
  }, [issuerId, isReference]);
  return (
    <IssuerChat
      tab=""
      onClose={onClose}
      live={isReference ? undefined : live}
      issuerName={issuerName}
    />
  );
}


// fallow-ignore-next-line complexity -- Global Ask ownership coordinates route, modal, profile, and issuer-chat lifecycles.
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

  const triggerPosition = pathname.startsWith("/sector") || pathname.startsWith("/command")
    ? "bottom-16 right-3"
    : "bottom-3 right-3";

  // Floating trigger, hidden while open. Deep-Dive also has an in-panel ASK
  // button, but this keeps ⌘K discoverable everywhere.
  const trigger = !open ? (
    <button
      onClick={toggle}
      title="Ask CAOS (Alt+K, or via the ⌘K palette) — cross-issuer query, or issuer Q&A in Deep-Dive / Model"
      className={`caos-ask-launcher fixed ${triggerPosition} z-overlay flex items-center gap-1.5 tabular text-caos-md px-2.5 py-1.5 rounded-full border border-caos-accent/60 bg-caos-panel text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring`}
      style={{ boxShadow: "var(--shadow-pop)" }}
    >
      <AskMark /> Ask
      <span className="tabular text-caos-2xs px-1 rounded border border-caos-border">Alt+K</span>
    </button>
  ) : null;

  // Deep-Dive renders its own chat from `open`; the launcher only supplies the trigger.
  if (scope === "deepdive") return <div className="caos-ask-dock contents">{trigger}</div>;
  if (!open) return <div className="caos-ask-dock contents">{trigger}</div>;

  // Model and other issuer-scoped concepts → the issuer Q&A slide-over, grounded in
  // the CURRENT issuer's live run (never the ATLF fixture, unless this IS the
  // reference deal). Only mounts when open, so useLiveRun fires only on demand. (F11)
  if (scope === "issuer") {
    return <div className="caos-ask-dock contents">{trigger}<IssuerScopedAsk onClose={() => setOpen(false)} /></div>;
  }

  // Everywhere else → the cross-issuer NL query, as a centered modal.
  return <div className="caos-ask-dock contents"><AskModal pathname={pathname} onClose={() => setOpen(false)} /></div>;
}

// Cross-issuer NL query — a true modal (backdrop + centered panel), so it gets
// focus-trap / restore / scroll-lock + dialog semantics via useModalA11y.
type AskAnalysisContext = ReturnType<typeof useAnalysisContext>;
type AskCapabilityMap = Map<string, { label: string; enabled: boolean; reason: string | null }>;

function useAskQueryState(prefill: string | null) {
  const [graph, setGraph] = useState<GraphResult | null>(null);
  const [graphErr, setGraphErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [text, setText] = useState(prefill ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<Capability[]>([]);
  const [cite, setCite] = useState<{ id: string; label?: string | null } | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [layout, setLayout] = useState<QueryView>("graph");
  const [queryRun, setQueryRun] = useState<QueryRun | null>(null);
  const resetSearch = useCallback(() => {
    setHasQueried(false);
    setGraph(null);
    setGraphErr(null);
    setNote(null);
    setSuggest([]);
    setText("");
  }, []);
  const openNode = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setReaderOpen(true);
  }, []);
  return {
    graph, setGraph, graphErr, setGraphErr, running, setRunning, text, setText,
    note, setNote, suggest, setSuggest, cite, setCite, selectedNode, setSelectedNode,
    readerOpen, setReaderOpen, hasQueried, setHasQueried, layout, setLayout,
    queryRun, setQueryRun, resetSearch, openNode,
  };
}

type AskQueryState = ReturnType<typeof useAskQueryState>;

function useAskCapabilities(concept: keyof typeof PROMPTS_BY_CONCEPT) {
  const [caps, setCaps] = useState<CapabilitiesResult | null>(null);
  const [capsErr, setCapsErr] = useState<string | null>(null);
  const capById = useMemo(() => {
    const map: AskCapabilityMap = new Map();
    caps?.groups.forEach((group) => group.capabilities.forEach((capability) => map.set(capability.id, capability)));
    return map;
  }, [caps]);
  useEffect(() => {
    let cancelled = false;
    queryCapabilities()
      .then((result) => {
        if (!cancelled) setCaps(result);
      })
      .catch((error) => {
        if (!cancelled) setCapsErr((error as Error)?.message || "could not load capabilities");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const prompts = useMemo(() => {
    const promptSet = PROMPTS_BY_CONCEPT[concept] || [];
    return promptSet.filter((prompt) => capById.get(prompt.id)?.enabled).slice(0, 4);
  }, [capById, concept]);
  return { caps, capsErr, capById, prompts };
}

type AskCapabilities = ReturnType<typeof useAskCapabilities>;

function useAskPinning(contextState: AskAnalysisContext, query: AskQueryState) {
  const [pinned, setPinned] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const pinningRef = useRef(false);
  const pinGeneration = useRef(0);
  const activeContextId = contextState.context?.id ?? null;
  const activeContextIdRef = useRef<string | null>(activeContextId);
  const activeQueryRunIdRef = useRef<string | null>(query.queryRun?.id ?? null);
  activeContextIdRef.current = activeContextId;
  activeQueryRunIdRef.current = query.queryRun?.id ?? null;

  const resetPinState = useCallback(() => {
    pinGeneration.current += 1;
    pinningRef.current = false;
    setPinning(false);
    setPinned(false);
    setPinError(null);
  }, []);

  useEffect(() => {
    resetPinState();
  }, [activeContextId, query.queryRun?.id, resetPinState]);

  const pinQueryFinding = useCallback(async () => {
    const context = contextState.context;
    const queryRun = query.queryRun;
    if (!context || !queryRun || pinned || pinningRef.current) return;
    const generation = ++pinGeneration.current;
    const contextId = context.id;
    const queryRunId = queryRun.id;
    pinningRef.current = true;
    setPinning(true);
    setPinError(null);
    try {
      await analysisApi.createFinding({
        context_id: contextId,
        kind: "global-ask-answer",
        title: query.graph?.title || queryRun.question,
        body: query.graph?.title ? queryRun.question : "",
        source_surface: "global-ask",
        source_run_id: queryRun.id,
        evidence: { result: queryRun.result, source_ids: queryRun.authority.source_ids },
      });
      if (generation === pinGeneration.current && activeContextIdRef.current === contextId && activeQueryRunIdRef.current === queryRunId) {
        setPinned(true);
      }
    } catch (error) {
      if (generation === pinGeneration.current && activeContextIdRef.current === contextId && activeQueryRunIdRef.current === queryRunId) {
        setPinError(toErrorMessage(error, "Finding was not pinned"));
      }
    } finally {
      if (generation === pinGeneration.current) {
        pinningRef.current = false;
        setPinning(false);
      }
    }
  }, [contextState.context, pinned, query.graph?.title, query.queryRun]);

  return { pinned, pinning, pinError, resetPinState, pinQueryFinding };
}

type AskPinning = ReturnType<typeof useAskPinning>;

function queryRunFailure(run: QueryRun) {
  if (run.status === "ready" || run.status === "observed-empty") return null;
  const missing = Array.isArray(run.result.missing_dependencies)
    ? " Missing: " + run.result.missing_dependencies.join(", ") + "."
    : "";
  return run.error || "Query " + run.status + "." + missing;
}

function useAskRun(
  contextState: AskAnalysisContext,
  capabilities: AskCapabilities,
  query: AskQueryState,
  pinning: AskPinning,
) {
  const runSeq = useRef(0);
  const resetPinState = pinning.resetPinState;
  return useCallback((capId: string) => {
    const seq = ++runSeq.current;
    resetPinState();
    query.setHasQueried(true);
    query.setRunning(true);
    query.setGraphErr(null);
    query.setNote(null);
    query.setSuggest([]);
    query.setSelectedNode(null);
    query.setReaderOpen(false);

    const context = contextState.context;
    if (!context) {
      query.setGraphErr(contextState.error || "Analysis context is not ready.");
      query.setRunning(false);
      return;
    }
    const question = query.text.trim() || capabilities.capById.get(capId)?.label || capId;
    analysisApi.createQueryRun({
      context_id: context.id,
      question,
      selected_lane: "graph",
      capability_id: capId,
    })
      .then((savedRun) => {
        if (seq !== runSeq.current) return;
        query.setQueryRun(savedRun);
        const failure = queryRunFailure(savedRun);
        if (failure) throw new Error(failure);
        const graph = savedRun.result as unknown as GraphResult;
        query.setGraph(graph);
        query.setLayout(nativeView(graph.capability_id, graph.mode));
      })
      .catch((error) => {
        if (seq !== runSeq.current) return;
        const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          || (error as Error)?.message || "could not run query";
        query.setGraphErr(String(detail));
      })
      .finally(() => {
        if (seq === runSeq.current) query.setRunning(false);
      });
  }, [capabilities.capById, contextState.context, contextState.error, query, resetPinState]);
}

function useAskSubmit(capabilities: AskCapabilities, query: AskQueryState, run: (capabilityId: string) => void) {
  return useCallback(() => {
    const question = query.text.trim().toLowerCase();
    if (!question) return;
    const allCapabilities = capabilities.caps?.groups.flatMap((group) => group.capabilities) ?? [];
    const scored = rankQueryCapabilities(question, allCapabilities);
    const runnable = scored.filter((candidate) => candidate.c.enabled).map((candidate) => candidate.c);
    if (!scored.length) {
      query.setHasQueried(true);
      query.setNote("No capability matched. Try one of these:");
      query.setSuggest(allCapabilities.filter((capability) => capability.enabled).slice(0, 4));
      return;
    }
    const best = scored[0].c;
    if (best.enabled) {
      run(best.id);
      return;
    }
    query.setHasQueried(true);
    query.setNote(best.label + " — " + best.reason + ". Runnable instead:");
    query.setSuggest(runnable.slice(0, 4));
  }, [capabilities.caps, query, run]);
}

function useAskModalController(pathname: string, onClose: () => void) {
  const contextState = useAnalysisContext({ name: "Global ASK investigation" });
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  const { prefill } = useAsk();
  const query = useAskQueryState(prefill);
  const capabilities = useAskCapabilities(conceptFor(pathname));
  const pinning = useAskPinning(contextState, query);
  const run = useAskRun(contextState, capabilities, query, pinning);
  const submit = useAskSubmit(capabilities, query, run);
  return { ...query, ...capabilities, ...pinning, panelRef, run, submit };
}

type AskModalController = ReturnType<typeof useAskModalController>;

function AskQueryInput({
  state, compact,
}: {
  state: AskModalController;
  compact: boolean;
}) {
  return (
    <div className={(compact ? "flex items-center gap-2 bg-caos-elevated px-3 py-2" : "flex-1 flex items-center gap-2 bg-caos-panel px-2.5 py-1") + " border border-caos-border rounded focus-within:border-caos-accent/70 transition-caos"}>
      <AskMark />
      <input
        value={state.text}
        onChange={(event) => state.setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") state.submit();
        }}
        placeholder={compact ? "Ask across coverage…" : "Type your query..."}
        aria-label="Query coverage"
        className="flex-1 bg-transparent outline-none tabular text-caos-md text-caos-text placeholder:text-caos-muted"
      />
      <button
        onClick={state.submit}
        className={(compact ? "px-3 py-1" : "px-2.5 py-0.5") + " tabular text-caos-xs rounded bg-caos-accent text-caos-bg font-medium hover:opacity-90 transition-caos focus-ring"}
      >
        Run
      </button>
    </div>
  );
}

function AskInitialView({ state, onClose }: { state: AskModalController; onClose: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between pb-1.5 border-b border-caos-border/50">
        <div className="flex items-center gap-2">
          <AskMark />
          <span className="tabular text-caos-xs text-caos-muted uppercase tracking-wider font-mono">Ask CAOS</span>
        </div>
        <CloseButton onClick={onClose} title="Close (Esc)" />
      </div>
      <AskQueryInput state={state} compact />
      {state.prompts.length > 0 && (
        <div className="mt-1 flex flex-col gap-2">
          <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted font-mono">Suggested queries</div>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {state.prompts.map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => state.run(prompt.id)}
                className="text-left bg-caos-elevated border border-caos-border hover:border-caos-accent/50 rounded p-2 transition-caos focus-ring flex flex-col justify-between h-full cursor-pointer"
              >
                <span className="tabular text-caos-sm text-caos-text leading-tight">{prompt.text}</span>
                <span className="tabular text-caos-3xs text-caos-muted font-mono mt-1">→ {prompt.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function AskExpandedHeader({ state, onClose }: { state: AskModalController; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3 border-b border-caos-border bg-caos-elevated/70 shrink-0">
      <button
        onClick={state.resetSearch}
        title="Back to search"
        className="text-caos-muted hover:text-caos-text text-caos-xs px-2.5 py-1 rounded border border-caos-border bg-caos-panel font-mono uppercase tracking-wider transition-caos cursor-pointer"
      >
        ← Back
      </button>
      <AskQueryInput state={state} compact={false} />
      <div className="h-6 w-px bg-caos-border" />
      <CloseButton onClick={onClose} title="Close (Esc)" />
    </div>
  );
}

function AskSuggestionNotice({ state }: { state: AskModalController }) {
  if (!state.note) return null;
  return (
    <div className="-mt-1 flex items-center gap-2 flex-wrap">
      <span className="tabular text-caos-sm text-caos-warning">{state.note}</span>
      {state.suggest.map((capability) => (
        <button
          key={capability.id}
          onClick={() => state.run(capability.id)}
          className="tabular text-caos-2xs px-2 py-0.5 rounded border border-caos-accent/50 text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring cursor-pointer"
        >
          {capability.label}
        </button>
      ))}
    </div>
  );
}

function AskLayoutSwitcher({ state }: { state: AskModalController }) {
  const graph = state.graph;
  if (!graph) return null;
  return (
    <div className="flex border border-caos-border rounded bg-caos-panel/40 p-0.5">
      {viewsFor(graph.capability_id, graph.mode).map((view) => (
        <button
          key={view}
          onClick={() => state.setLayout(view)}
          className={"tabular text-caos-3xs uppercase tracking-wider px-2 py-0.5 rounded transition-caos cursor-pointer font-mono " + (state.layout === view ? "bg-caos-accent text-caos-bg font-semibold" : "text-caos-muted hover:text-caos-text hover:bg-caos-elevated/40")}
        >
          {VIEW_LABELS[view]}
        </button>
      ))}
    </div>
  );
}

function pinButtonLabel(state: AskModalController) {
  if (state.pinned) return "PINNED";
  if (state.pinning) return "PINNING…";
  if (state.pinError) return "RETRY PIN";
  return "PIN FINDING";
}

function AskResultActions({ state }: { state: AskModalController }) {
  const graph = state.graph;
  if (!graph) return null;
  return (
    <div className="flex items-center gap-3">
      <AskLayoutSwitcher state={state} />
      <div className="h-4 w-px bg-caos-border hidden sm:block" />
      {graph.meta.map((item, index) => (
        <span key={index} className="tabular text-caos-2xs text-caos-muted font-mono whitespace-nowrap hidden sm:inline">
          {item}{index < graph.meta.length - 1 ? " ·" : ""}
        </span>
      ))}
      <div className="flex gap-1.5 ml-2">
        <button
          type="button"
          onClick={() => void state.pinQueryFinding()}
          disabled={!state.queryRun || state.pinned || state.pinning}
          className="tabular text-caos-xs px-2 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos cursor-pointer focus-ring disabled:opacity-40"
        >
          {pinButtonLabel(state)}
        </button>
        {state.pinError ? <span role="alert" className="self-center text-caos-2xs text-caos-critical">{state.pinError}</span> : null}
        <button onClick={() => downloadQueryCsv(graph)} className="tabular text-caos-xs px-2 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos cursor-pointer">CSV</button>
        <button onClick={() => window.print()} className="tabular text-caos-xs px-2 py-0.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos cursor-pointer">PDF</button>
      </div>
    </div>
  );
}

function AskResultHeader({ state }: { state: AskModalController }) {
  if (!state.graph || state.graphErr) return null;
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="tabular text-caos-3xs uppercase tracking-wide text-caos-accent border border-caos-accent/40 bg-caos-accent/10 rounded px-1.5 py-px">{state.graph.mode}</span>
        <span className="tabular text-caos-md text-caos-text">{state.graph.title}</span>
        {state.running && <span className="tabular text-caos-2xs text-caos-muted caos-running">running…</span>}
      </div>
      <AskResultActions state={state} />
    </div>
  );
}

function AskCenteredStatus({ children, warning = false }: { children: React.ReactNode; warning?: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-6">
      <div className={"tabular text-caos-md " + (warning ? "text-caos-warning" : "text-caos-muted")}>{children}</div>
    </div>
  );
}

function AskGraphView({ state }: { state: AskModalController }) {
  const graph = state.graph!;
  if (state.layout === "rv") {
    return <RelativeValueTable graph={graph} selectedNodeId={state.selectedNode?.id} onSelectNode={state.openNode} />;
  }
  if (state.layout === "scatter") {
    return <ScatterCanvas graph={graph} selectedNodeId={state.selectedNode?.id} onSelectNode={state.openNode} />;
  }
  if (state.layout === "trace") {
    return <LineageFlow graph={graph} selectedNodeId={state.selectedNode?.id} onSelectNode={state.openNode} />;
  }
  return <GraphCanvas graph={graph} onOpenChunk={(id, label) => state.setCite({ id, label })} onSelectNode={state.openNode} />;
}

function AskResultSurface({ state }: { state: AskModalController }) {
  let content: React.ReactNode;
  if (state.capsErr) content = <AskCenteredStatus warning>Couldn&apos;t load capabilities — {state.capsErr}</AskCenteredStatus>;
  else if (state.graphErr) content = <AskCenteredStatus warning>Query failed — {state.graphErr}</AskCenteredStatus>;
  else if (state.running && !state.graph) content = <AskCenteredStatus>Walking the graph…</AskCenteredStatus>;
  else if (!state.graph) content = <AskCenteredStatus>Submit a query to view results.</AskCenteredStatus>;
  else content = <AskGraphView state={state} />;
  return <div className="flex-1 min-h-0 flex flex-col bg-caos-bg border border-caos-border rounded-md p-2 relative">{content}</div>;
}

function AskCaveats({ state }: { state: AskModalController }) {
  if (!state.graph?.caveats.length) return null;
  return (
    <div className="tabular text-caos-3xs text-caos-muted font-mono flex items-start gap-1.5 shrink-0">
      <span aria-hidden>ⓘ</span>
      <span>{state.graph.caveats.join(" · ")}</span>
    </div>
  );
}

function AskResultMain({ state }: { state: AskModalController }) {
  return (
    <main className="flex-1 min-w-0 min-h-0 flex flex-col p-4 gap-3 overflow-hidden">
      <AskSuggestionNotice state={state} />
      <AskResultHeader state={state} />
      <AskResultSurface state={state} />
      <AskCaveats state={state} />
    </main>
  );
}

function AskReaderField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-0.5">{label}</div>
      {children}
    </div>
  );
}

function AskReader({ state }: { state: AskModalController }) {
  const node = state.selectedNode;
  if (!state.readerOpen || !node) return null;
  return (
    <aside className="w-[380px] border-l border-caos-border bg-caos-panel flex flex-col p-4 gap-4 overflow-y-auto shrink-0 relative transition-caos" aria-label="Node detail reader">
      <div className="flex items-start justify-between pb-2 border-b border-caos-border">
        <div>
          <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-accent font-mono">{node.kind.replace("-", " ")}</span>
          <h2 className="tabular text-caos-md font-mono text-caos-text mt-0.5 leading-snug break-all">{node.label}</h2>
        </div>
        <button onClick={() => state.setReaderOpen(false)} className="text-caos-muted hover:text-caos-text text-caos-xl font-bold px-1.5 focus-ring cursor-pointer" aria-label="Close panel">&times;</button>
      </div>
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {node.sub && <AskReaderField label="Description"><div className="text-caos-sm text-caos-text leading-relaxed font-sans">{node.sub}</div></AskReaderField>}
        {node.title && <AskReaderField label="Summary / Detail"><div className="text-caos-xs text-caos-text/90 leading-relaxed bg-caos-bg/50 border border-caos-border rounded p-2 font-mono whitespace-pre-wrap">{node.title}</div></AskReaderField>}
        {node.group && <AskReaderField label="Category Group"><span className="tabular text-caos-3xs text-caos-text bg-caos-bg border border-caos-border rounded px-1.5 py-0.5 inline-block">{node.group}</span></AskReaderField>}
        {node.confidence && (
          <AskReaderField label="Confidence">
            <span className="tabular text-caos-3xs font-semibold px-2 py-0.5 rounded border" style={sevSurface(node.confidence === "High" ? "ok" : "warning", { border: 33, wash: 7 })}>{node.confidence}</span>
          </AskReaderField>
        )}
      </div>
      {node.obsidian_url && (
        <div className="pt-3 border-t border-caos-border shrink-0">
          <a href={node.obsidian_url} className="w-full flex items-center justify-center gap-1.5 tabular text-caos-xs font-semibold py-2 px-3 rounded bg-caos-accent text-caos-bg hover:opacity-90 transition-caos text-center focus-ring">
            <span>REVEAL IN OBSIDIAN WIKI</span><span aria-hidden className="text-caos-2xs">↗</span>
          </a>
        </div>
      )}
    </aside>
  );
}

function AskExpandedView({ state, onClose }: { state: AskModalController; onClose: () => void }) {
  return (
    <>
      <AskExpandedHeader state={state} onClose={onClose} />
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <AskResultMain state={state} />
        <AskReader state={state} />
      </div>
    </>
  );
}

function AskPanel({ state, onClose }: { state: AskModalController; onClose: () => void }) {
  return (
    <div
      ref={state.panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Ask with Query"
      onClick={(event) => event.stopPropagation()}
      className={"caos-enter bg-caos-panel border-l border-caos-border h-full w-full flex flex-col overflow-hidden " + (state.hasQueried ? "max-w-4xl" : "max-w-md p-4 gap-3.5")}
      style={{ boxShadow: "var(--shadow-modal)" }}
    >
      {state.hasQueried ? <AskExpandedView state={state} onClose={onClose} /> : <AskInitialView state={state} onClose={onClose} />}
    </div>
  );
}

function AskModal({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const state = useAskModalController(pathname, onClose);
  return (
    <ModalBackdrop onClose={onClose} align="end">
      <AskPanel state={state} onClose={onClose} />
      {state.cite && <CitationViewer chunkId={state.cite.id} label={state.cite.label} onClose={() => state.setCite(null)} />}
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
