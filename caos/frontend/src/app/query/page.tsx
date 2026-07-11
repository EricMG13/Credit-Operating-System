"use client";

// Concept H — Query: the standalone surface that traverses the run-derived
// store (peer links, provenance chains, module DAGs, sector clusters) to widen
// analysis beyond a single issuer. Layout is analyst-first: a question rail
// grouped by job, one command bar (suggestions live in its focus dropdown),
// and an answer that always leads with a plain-English synthesis line above
// its native visualization. Views are gated per graph shape and reset on every
// run; a permanent evidence dock keeps every conclusion one click from its
// grounding (slide-over below lg so selection is never a silent no-op).

import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { GroupLauncher } from "@/components/query/GroupLauncher";
import { EvidenceDock } from "@/components/query/EvidenceDock";
import { VaultMemoUpload } from "@/components/query/VaultMemoUpload";
import { InsightFeed } from "@/components/query/InsightFeed";
import { AiAnswer } from "@/components/query/AiAnswer";
import { GraphCanvas } from "@/components/query/GraphCanvas";
import { RelativeValueTable } from "@/components/query/RelativeValueTable";
import { ScatterCanvas } from "@/components/query/ScatterCanvas";
import { LineageFlow } from "@/components/query/LineageFlow";
import { CitationViewer } from "@/components/command/CitationViewer";
import { QueryResultsModal } from "@/components/command/NlQuery";
import { QueryPrintSheet } from "@/components/query/QueryPrintSheet";
import { QueryReportSheet } from "@/components/query/QueryReportSheet";
import { ReportRail } from "@/components/query/ReportRail";
import { useNotify } from "@/components/shared/Notifications";
import { acceptQueryLink, listQueryLinks, nlQuery, queryAnswer, queryCapabilities, queryGraph, queryInsights, queryOverlay, queryRoute, retractQueryLink } from "@/lib/api";
import type { AnswerResult, Capability, CapabilitiesResult, GraphResult, GraphNode, InsightBrief, InsightCard, OverlayEdge, OverlayResult } from "@/lib/query/graph";
import type { NlQueryResult } from "@/lib/query/types";
import { pairKey } from "@/lib/query/graph";
import { addSection, parseStoredReport, removeSection, REPORT_STORAGE_KEY, sectionId, type ReportSection } from "@/lib/query/report";
import { downloadQueryCsv } from "@/lib/query/export";
import { rankQueryCapabilities } from "@/lib/query/routing";
import { engineNote, QUESTIONS, questionFor, questionGroups } from "@/lib/query/questions";
import { coerceView, nativeView, viewsFor, VIEW_LABELS, type QueryView } from "@/lib/query/views";
import { synthesize } from "@/lib/query/synthesis";
import { MODEL_HUE } from "@/components/query/node-style";
import { ResponsiveShell, type NarrowContract } from "@/components/shared/ResponsiveShell";
import Link from "next/link";
import { ConceptNav } from "@/components/shared/ConceptNav";

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

// Short human tag for the answer-header chip, keyed on the CAPABILITY, not the
// engine mode: several walks share mode "concentration" (scatter, distribution),
// so a leverage scatter would wrongly read "CONCENTRATION". The id is the walk's
// stable identity; strip the -map/-graph suffix and humanise (chip CSS uppercases).
const capLabel = (capabilityId: string): string =>
  capabilityId.replace(/-(map|graph)$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

// Distil a routed NL question into a concise risk theme for the shared-theme
// walk — the raw sentence would otherwise become the driver node's label
// ("…the which names mention a tariff theme driver"). Strips leading
// interrogatives/verbs and the trailing theme/exposure tail; falls back to the
// raw text when nothing meaningful survives. Heuristic — the analyst sees the
// result in the Risk-theme box and can refine it.
const themeFromQuery = (q: string): string => {
  const cleaned = q
    .replace(/^\s*((which|what|who|whose|any|show|find|list|names?|issuers?|credits?|that|do|does|have|has|share|shares|mention|mentions|exposed?|to|the|an?|are|is|with)\s+)+/gi, "")
    .replace(/\s*\b(theme|exposure|exposed|risk|names?|issuers?|credits?)\s*\??$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 120) : q.slice(0, 120);
};

function QueryWorkspace() {
  const [caps, setCaps] = useState<CapabilitiesResult | null>(null);
  const [capsErr, setCapsErr] = useState<string | null>(null);
  const [graph, setGraph] = useState<GraphResult | null>(null);
  const [graphErr, setGraphErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null); // launcher popover
  const [railCollapsed, setRailCollapsed] = useState(false); // report/evidence panel
  const [text, setText] = useState("");
  const [theme, setTheme] = useState(""); // free-text risk theme for the shared-theme walk
  const [note, setNote] = useState<string | null>(null);
  // Note tone: Routed/Routing read as info (accent/muted, no "!"); only real
  // misses and failures read as a warning.
  const [noteKind, setNoteKind] = useState<"info" | "warn">("warn");
  const [routing, setRouting] = useState(false); // in-flight LLM route (pulse + Cancel)
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
  // Active-descendant index into the flattened command-bar dropdown (Recent +
  // Runnable-now), -1 = no active item. Keyboard arrows move it; Enter runs it.
  const [activeSuggest, setActiveSuggest] = useState(-1);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  // Q1 Desk Brief — proactive AI research, loaded on open (no prompting).
  const [brief, setBrief] = useState<InsightBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefCollapsed, setBriefCollapsed] = useState(false);
  // NOTE: Phase-2 watchlist editor (WatchlistEditor.tsx + /api/query/watchlist)
  // is built but not yet rendered here — re-add the import + a collapsible toggle
  // when wiring the Desk-Brief personalization control into this layout.
  // Layout F — the running report the analyst assembles, the right-rail tab, and
  // which print-root is live (only one at a time so window.print never doubles).
  const [report, setReport] = useState<ReportSection[]>([]);
  const [railTab, setRailTab] = useState<"report" | "evidence">("report");
  const [printMode, setPrintMode] = useState<"graph" | "report">("graph");
  // Q2 grounded answer — the cited AI paragraph beside a typed question's walk.
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [answerLoading, setAnswerLoading] = useState(false);
  const answerSeq = useRef(0);
  // One-box unification (additive) — the "Scan metrics" lane: an explicit
  // secondary action beside the walk-primary Run button. Calls the /nl metric
  // planner and renders the ranked table / evidence list in the shared
  // QueryResultsModal (reused from the Command Center /nl box). Walk stays the
  // primary action (Enter); the analyst chooses the metric lane explicitly, so
  // intent is never silently misrouted (RT-2026-07-07-26). Auto-detection is a
  // documented follow-on, not this phase.
  const [metricRes, setMetricRes] = useState<NlQueryResult | null>(null);
  const [metricBusy, setMetricBusy] = useState(false);
  const [metricErr, setMetricErr] = useState<string | null>(null);
  const [metricOpen, setMetricOpen] = useState(false);
  const [metricLive, setMetricLive] = useState("");
  const metricAbort = useRef<AbortController | null>(null);
  // Q3 ambient overlay: fire the model overlay once per session on the analyst's
  // first explicit walk, so there is model commentary without per-click spend.
  const didAutoOverlay = useRef(false);
  const userInitiated = useRef(false); // an explicit pick/submit happened (not the auto-run)
  const briefPolls = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null); // wraps input + dropdown; blur only closes when focus leaves it
  const tablistRef = useRef<HTMLDivElement>(null);
  const notify = useNotify();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("caos:query-history");
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        // Element-shape check, not just Array.isArray: a hand-edited or
        // schema-drifted entry ([null], {text: 42}) would otherwise crash the
        // dropdown render / addToHistory on every visit until storage is cleared.
        if (Array.isArray(parsed)) {
          setHistory(parsed.filter((h): h is HistoryEntry =>
            !!h && typeof h === "object"
            && typeof (h as HistoryEntry).text === "string"
            && typeof (h as HistoryEntry).capId === "string"));
        }
      }
    } catch (e) {
      console.warn("Could not load history", e);
    }
  }, []);

  // Rehydrate the running report from localStorage, then persist every change.
  // The report is a whole session of work; a refresh, crash, or stray
  // navigation must not silently destroy it. `reportHydrated` gates the write
  // effect so the first render (empty state) can't overwrite a stored report
  // before rehydration lands.
  const reportHydrated = useRef(false);
  useEffect(() => {
    try {
      const restored = parseStoredReport(localStorage.getItem(REPORT_STORAGE_KEY));
      if (restored.length > 0) setReport(restored);
    } catch (e) {
      console.warn("Could not load report", e);
    }
    reportHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!reportHydrated.current) return;
    try {
      if (report.length > 0) localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(report));
      else localStorage.removeItem(REPORT_STORAGE_KEY);
    } catch (e) {
      console.warn("Could not save report", e);
    }
  }, [report]);

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
  // Route each grounded brief card to its group (by the card's walk → job), so a
  // group popover can show the AI analysis already surfaced for that theme.
  const cardsByGroup = useMemo(() => {
    const out: Record<string, InsightCard[]> = {};
    for (const card of brief?.cards ?? []) {
      const job = card.walk ? QUESTIONS[card.walk]?.job : undefined;
      if (!job) continue;
      (out[job] ??= []).push(card);
    }
    return out;
  }, [brief]);
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
  // Route sequence: a late resolve (or a Cancel) from a superseded in-flight
  // route must never overwrite a newer run; picking a walk directly also
  // supersedes any pending route.
  const routeSeq = useRef(0);
  const run = useCallback((capId: string, capMode?: string, toast = false, themeArg?: string) => {
    // Ignore out-of-order results: a slow earlier queryGraph must not clobber a
    // newer one (graph/error/running guarded on the latest sequence).
    const seq = ++runSeq.current;
    routeSeq.current++; // a direct run supersedes any in-flight route
    setRouting(false);
    setActiveId(capId);
    setRunning(true);
    setGraphErr(null);
    setNote(null);
    setSuggest([]);
    setSelectedNode(null);
    setSheetOpen(false);
    setOverlay(null); // model overlay belongs to ONE graph — never carries across runs
    // The grounded AI answer belongs to the previous question — clear it; a typed
    // submit re-populates it below, a rail pick leaves it cleared.
    answerSeq.current++;
    setAnswer(null);
    setAnswerLoading(false);
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
    userInitiated.current = true; // an explicit walk — arms the one-shot ambient overlay
    setBriefCollapsed(true); // collapse the brief so the graph is the hero (layout F)
    run(capId, capById.get(capId)?.mode);
  }, [run, capById]);

  // Q1 — load the proactive Desk Brief. Returns instantly (persisted brief or
  // deterministic highlights); while a background regeneration is in flight the
  // payload says refreshing:true, so poll a bounded few times to swap in the AI
  // brief when it lands. Never blocks the surface; a failure just leaves no panel.
  const loadBrief = useCallback((force = false) => {
    setBriefLoading(true);
    queryInsights(force)
      .then((b) => {
        setBrief(b);
        if (b.refreshing && briefPolls.current < 4) {
          briefPolls.current += 1;
          setTimeout(() => loadBrief(false), 8000);
        } else {
          briefPolls.current = 0;
        }
      })
      .catch(() => { /* proactive extra; absence just hides the panel */ })
      .finally(() => setBriefLoading(false));
  }, []);

  // Q2 — fetch the grounded AI answer for a typed question, beside its walk. Only
  // runs when the model lane is up; sequence-guarded so a stale answer can't land
  // over a newer question. Degrades to an explicit "unavailable" note, never throws.
  const fetchAnswer = useCallback((question: string, capId: string, issuerId?: string) => {
    if (!caps?.availability?.model_lane) return;
    const seq = ++answerSeq.current;
    setAnswer(null);
    setAnswerLoading(true);
    queryAnswer(question, capId, issuerId)
      .then((a) => {
        if (seq !== answerSeq.current) return;
        setAnswer(a);
        // Auto-assemble: a grounded answer drops into the running report as a
        // cited section. Ungrounded/empty answers are not filed.
        if (!a.unavailable && a.answer) {
          setReport((prev) => addSection(prev, {
            id: sectionId("answer", question), kind: "answer", title: question,
            body: a.answer, sources: a.citations.map((c) => ({ label: c.label, chunk_id: c.chunk_id })),
            capabilityId: capId, ai: true, addedAt: Date.now(),
          }));
        }
      })
      .catch(() => {
        if (seq === answerSeq.current) {
          setAnswer({
            answer: "", sentences: [], citations: [], unavailable: true, model: null,
            created_at: null, cached: false,
            reason: "Model answer unavailable — the deterministic result stands.",
          });
        }
      })
      .finally(() => { if (seq === answerSeq.current) setAnswerLoading(false); });
  }, [caps]);

  // Layout F — pin a brief card into the report, export the report to PDF, drop a
  // section, wipe the report. Export toggles the live print-root to the report
  // sheet, prints, then flips back so the per-graph exhibit prints normally again.
  const pinInsight = useCallback((card: InsightCard) => {
    setReport((prev) => addSection(prev, {
      id: sectionId("insight", card.headline), kind: "insight", title: card.headline,
      body: card.detail, sources: card.evidence.map((e) => ({ label: e.label, chunk_id: e.chunk_id })),
      capabilityId: card.walk ?? undefined, ai: true, addedAt: Date.now(),
    }));
    notify("Pinned to report", card.headline);
  }, [notify]);

  useEffect(() => {
    if (printMode !== "report") return;
    // Let the report print-root mount + paint before printing, then restore the
    // graph print-root so the PRINT/PDF button keeps printing the single exhibit.
    const t = setTimeout(() => { window.print(); setPrintMode("graph"); }, 120);
    return () => clearTimeout(t);
  }, [printMode]);

  useEffect(() => {
    listQueryLinks()
      .then((r) => setAcceptedPairs(new Map(r.links.map((l) => [pairKey(l.issuer_a, l.issuer_b), l.id]))))
      .catch(() => {}); // read-only state seed; absence just means no UNDO markers
  }, []);

  // Q1 — the Desk Brief greets the analyst on open, no prompting.
  useEffect(() => { loadBrief(false); }, [loadBrief]);

  // Q3 — one ambient overlay per session, on the analyst's first explicit walk.
  // Keyed off graph so it fires after the graph is on the canvas; guarded so the
  // auto-run-on-load graph and every later walk don't spend a model call.
  useEffect(() => {
    if (!graph || didAutoOverlay.current || !userInitiated.current) return;
    if (!caps?.availability?.model_lane) return;
    didAutoOverlay.current = true;
    setOverlayBusy(true);
    // Seq guard (same contract as queryGraph): the overlay lane runs 30–130s, so a
    // late resolution after the analyst ran a different question must not attach
    // the OLD graph's overlay to the new graph. run() clears overlay + bumps seq.
    const seq = runSeq.current;
    queryOverlay(graph.capability_id)
      .then((o) => { if (seq === runSeq.current) setOverlay((cur) => cur ?? o); }) // never clobber a manual toggle
      .catch(() => { /* ambient — silent, the deterministic graph is untouched */ })
      .finally(() => setOverlayBusy(false));
  }, [graph, caps]);

  // Re-fetch the current graph WITHOUT clearing the overlay — after a ratify the
  // deterministic payload now draws the solid accepted edge; the overlay stays up
  // so the analyst can accept several proposals in one sitting.
  const refreshGraph = useCallback(() => {
    if (!activeId) return;
    queryGraph(activeId, undefined, activeId === "shared-theme" ? theme : undefined)
      .then(setGraph)
      // The link IS stored server-side; only the redraw failed. Don't leave the
      // "ratified" toast sitting over a graph that never drew the new edge —
      // tell the analyst the view is stale so they reload. SEAM3-8.
      .catch(() => notify("Graph not refreshed", "The link is stored — reload to see it drawn."));
  }, [activeId, theme, notify]);

  const acceptLink = useCallback((edge: OverlayEdge) => {
    if (!activeId) return;
    // Resolve edge endpoints to their node labels for the toast — a raw UUID
    // pair ("33333333-… ⇢ a71f0000-…") is unreadable at the desk. Fall back to
    // the id only if the current graph has no label for it.
    const labelOf = new Map((graph?.nodes ?? []).map((n) => [n.id, n.label]));
    const src = labelOf.get(edge.source) ?? edge.source;
    const tgt = labelOf.get(edge.target) ?? edge.target;
    acceptQueryLink(edge, activeId, overlay?.model ?? null)
      .then((l) => {
        setAcceptedPairs((prev) => new Map(prev).set(pairKey(l.issuer_a, l.issuer_b), l.id));
        notify("Link ratified", `${src} ⇢ ${tgt} is now stored graph data`);
        // A ratified connection files into the report as a deterministic section.
        setReport((prev) => addSection(prev, {
          id: sectionId("link", `${src} ${tgt}`), kind: "link", title: `${src} ⇢ ${tgt}`,
          body: edge.rationale || "", sources: (edge.chunk_ids || []).map((cid) => ({ label: "source", chunk_id: cid })),
          capabilityId: activeId, ai: false, addedAt: Date.now(),
        }));
        refreshGraph();
      })
      .catch((e) => {
        const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          || (e as Error)?.message || "could not accept link";
        notify("Accept failed", String(d));
      });
  }, [activeId, overlay, notify, refreshGraph, graph]);

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

  // Which history rows the dropdown shows — must match the render slice so the
  // active-descendant index lines up with the rendered options.
  const historyRows = useMemo(() => history.slice(0, 3), [history]);
  // Flatten Recent + Runnable-now into one ordered option list so the
  // ArrowUp/Down/Enter keyboard path and the rendered listbox share one index
  // space. Each option knows how to run itself (mirrors the button handlers).
  const suggestOptions = useMemo(
    () => [
      ...historyRows.map((h, i) => ({
        key: `hist-${i}`,
        run: () => { setText(h.text); setSearchOpen(false); pick(h.capId); },
      })),
      ...prompts.map((p) => ({
        key: `prompt-${p.id}`,
        run: () => { setSearchOpen(false); addToHistory(questionFor(p), p.id, p.label); pick(p.id); },
      })),
    ],
    [historyRows, prompts, pick, addToHistory],
  );
  const suggestOpen = searchOpen && suggestOptions.length > 0;
  // Reset the active row whenever the option set changes or the menu closes, so
  // a stale index never points past the list.
  useEffect(() => { setActiveSuggest(-1); }, [suggestOptions, searchOpen]);

  // Keyword-route the free text to the best enabled walk; a miss or a greyed
  // best match surfaces the closest runnable walks as did-you-mean chips.
  // `lead` prefixes the note when the deterministic path is a fallback (e.g. the
  // model router was unavailable) so a 503 stays distinguishable from "no match".
  const keywordSubmit = useCallback((lead?: string) => {
    const q = text.trim().toLowerCase();
    if (!q) return;
    const prefix = lead ? `${lead} ` : "";
    const allCaps = caps?.groups.flatMap((g) => g.capabilities) ?? [];
    const scored = rankQueryCapabilities(q, allCaps);
    const runnable = scored.filter((x) => x.c.enabled).map((x) => x.c);
    if (scored.length === 0) {
      setNoteKind("warn");
      setNote(`${prefix}No question matched. Try one of these:`);
      setSuggest(allCaps.filter((c) => c.enabled).slice(0, 4));
      return;
    }
    const best = scored[0].c;
    if (best.enabled) {
      addToHistory(text, best.id, best.label);
      userInitiated.current = true;
      setBriefCollapsed(true);
      // Carry the analyst's question into the theme walk so a keyword-routed
      // theme match answers what they asked — not the default energy theme.
      if (best.id === "shared-theme") {
        const t = themeFromQuery(text.trim());
        setTheme(t);
        run(best.id, best.mode, true, t); // clears note/suggest for the new run
      } else {
        run(best.id, best.mode, true); // clears note/suggest for the new run
      }
      // Q2 — a typed question also gets a grounded AI answer beside its walk.
      fetchAnswer(text.trim(), best.id);
      // A matched fallback is a neutral result, not a warning; a bare keyword
      // hit leaves the note cleared as before. Set AFTER run() so it survives.
      if (lead) {
        setNoteKind("info");
        setNote(`${lead} matched by keyword: ${best.label}`);
      }
      return;
    }
    setNoteKind("warn");
    setNote(`${prefix}${best.label} — ${best.reason}. Runnable instead:`);
    setSuggest(runnable.slice(0, 4));
  }, [text, caps, run, addToHistory, fetchAnswer]);

  // Cancel abandons an in-flight route: bump the sequence so the pending
  // .then()/.catch() short-circuits, and clear the pending note.
  const cancelRoute = useCallback(() => {
    routeSeq.current++;
    setRouting(false);
    setNote(null);
    setSuggest([]);
  }, []);

  // One-box unification — the "Scan metrics" lane (additive secondary action).
  // Calls the /nl metric planner and opens the shared QueryResultsModal with the
  // ranked table / evidence list. Independent of the walk flow: it does NOT touch
  // graph/answer/route state, so a metric scan never disturbs a live walk. A
  // second click while in-flight aborts (button reads CANCEL). Fault-isolated: a
  // 422 ("Couldn't map that to a known metric") surfaces as an in-modal hint, not
  // a page-level error — the analyst can rephrase or fall back to Run (walk).
  const cancelMetric = useCallback(() => {
    metricAbort.current?.abort();
  }, []);

  const scanMetrics = useCallback(() => {
    const question = text.trim();
    if (!question || metricBusy) return;
    const ctrl = new AbortController();
    metricAbort.current = ctrl;
    setMetricBusy(true);
    setMetricErr(null);
    setMetricRes(null);
    setMetricOpen(true);
    setMetricLive("Scanning the metric store…");
    nlQuery(question, ctrl.signal)
      .then((r) => {
        setMetricRes(r);
        const n = r.rows.length;
        setMetricLive(`${n} ${n === 1 ? "issuer" : "issuers"} returned.`);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) {
          setMetricRes(null);
          setMetricLive("Scan cancelled.");
          return;
        }
        const detail = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
          || (e as Error)?.message || "scan failed";
        setMetricErr(String(detail));
        setMetricRes(null);
        setMetricLive("Scan failed.");
      })
      .finally(() => {
        if (metricAbort.current === ctrl) metricAbort.current = null;
        setMetricBusy(false);
      });
  }, [text, metricBusy]);

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
    const seq = ++routeSeq.current;
    setRouting(true);
    setNoteKind("info");
    setNote("Routing…");
    setSuggest([]);
    queryRoute(q)
      .then((r) => {
        if (seq !== routeSeq.current) return; // cancelled / superseded
        setRouting(false);
        if (r.candidates.length === 0) {
          // Non-silent: the router found no candidate, so we degrade to the
          // deterministic keyword match — say so (info, not a warning) so the
          // analyst sees why the walk was chosen rather than a silent swap.
          keywordSubmit("No model match —");
          return;
        }
        const top = r.candidates.find((c) => c.enabled) ?? r.candidates[0];
        const rest = r.candidates.filter((c) => c.id !== top.id);
        const restCaps = rest
          .map((c) => capById.get(c.id))
          .filter(Boolean) as Capability[];
        if (top.enabled) {
          addToHistory(q, top.id, top.label);
          userInitiated.current = true;
          setBriefCollapsed(true);
          // Carry the analyst's question into the theme walk so the answer
          // matches what they asked — not the default energy theme.
          if (top.id === "shared-theme") {
            const t = themeFromQuery(q);
            setTheme(t);
            run(top.id, capById.get(top.id)?.mode, true, t);
          } else {
            run(top.id, capById.get(top.id)?.mode, true);
          }
          // Q2 — grounded AI answer beside the routed walk.
          fetchAnswer(q, top.id);
          setNoteKind("info");
          setNote(`Routed: ${top.reason || top.label}${restCaps.length ? " · also:" : ""}`);
          setSuggest(restCaps);
        } else {
          setNoteKind("warn");
          setNote(`${top.label} — ${capById.get(top.id)?.reason ?? "unavailable"}. Runnable instead:`);
          setSuggest(restCaps.filter((c) => c.enabled));
        }
      })
      .catch((e) => {
        if (seq !== routeSeq.current) return; // cancelled / superseded
        setRouting(false);
        // A 429 is the query rate limiter, not an outage — tell the analyst to
        // wait rather than mislabel it "unavailable". Either way, fall back to the
        // deterministic keyword router. SEAM3-9.
        const st = (e as { response?: { status?: number } })?.response?.status;
        keywordSubmit(st === 429 ? "Query rate limit reached —" : "Model router unavailable —");
      });
  }, [text, caps, capById, keywordSubmit, run, addToHistory, fetchAnswer]);

  // Close the dropdown only when focus actually leaves the whole composer — a
  // Tab into a suggestion button must NOT dismiss the menu (the old input-only
  // onBlur trapped keyboard users out of Recent entirely).
  const onComposerBlur = useCallback((e: FocusEvent<HTMLDivElement>) => {
    if (!composerRef.current?.contains(e.relatedTarget as Node | null)) {
      setSearchOpen(false);
    }
  }, []);

  // Input keyboard nav: ArrowDown/Up move the active descendant across the
  // flattened options, Enter runs the active one (or submits the typed query
  // when none is active), Escape closes.
  const onInputKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") { setSearchOpen(false); setActiveSuggest(-1); return; }
    if (suggestOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setActiveSuggest((cur) => {
        const n = suggestOptions.length;
        if (e.key === "ArrowDown") return cur < 0 ? 0 : (cur + 1) % n;
        return cur <= 0 ? n - 1 : cur - 1;
      });
      return;
    }
    if (e.key === "Enter") {
      if (suggestOpen && activeSuggest >= 0 && activeSuggest < suggestOptions.length) {
        e.preventDefault();
        suggestOptions[activeSuggest].run();
        return;
      }
      submit();
    }
  }, [suggestOpen, suggestOptions, activeSuggest, submit]);

  const views = useMemo(() => (graph ? viewsFor(graph.capability_id, graph.mode) : []), [graph]);
  const activeView = graph ? coerceView(view, graph.capability_id, graph.mode) : view;

  // Roving arrow-key nav across the view tabs (ArrowLeft/Right, Home/End) — a
  // WAI-ARIA tablist must be operable without a mouse.
  const onTabKeyDown = useCallback((e: KeyboardEvent) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key) || views.length === 0) return;
    e.preventDefault();
    const i = Math.max(0, views.indexOf(activeView));
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? views.length - 1
      : e.key === "ArrowLeft" ? (i - 1 + views.length) % views.length
      : (i + 1) % views.length;
    setView(views[next]);
    (tablistRef.current?.children[next] as HTMLElement | undefined)?.focus();
  }, [views, activeView]);

  // A ratified proposal is drawn solid by the deterministic graph — hide its
  // dashed twin (a stale cached overlay can still contain the pair).
  const visibleOverlayEdges = useMemo(() => {
    if (!overlay) return undefined;
    const drawn = new Set((graph?.edges ?? []).map((e) => pairKey(e.source, e.target)));
    return overlay.edges.filter((e) => !drawn.has(pairKey(e.source, e.target)));
  }, [overlay, graph]);

  const narrowContract: NarrowContract = {
    essentialControls: (
      <>
        <VaultMemoUpload
          onUploaded={() => {
            queryCapabilities().then(setCaps).catch(() => {});
            if (activeId === "analyst-memos") pick("analyst-memos");
          }}
        />
        <MetricPill label="answerable" value={caps ? `${totalReady}/${totalCaps}` : "loading"} />
      </>
    ),
  };

  return (
    <ResponsiveShell
      identity={
        <>
          <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap">
            ← Directory
          </Link>
          <span className="h-4 w-px bg-caos-border shrink-0" />
          <ConceptNav compact />
          <span className="h-4 w-px bg-caos-border shrink-0" />
          <QueryMark />
          <div className="min-w-0">
            <div className="tabular text-caos-xl text-caos-text font-semibold leading-none">Query</div>
            <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted leading-none mt-1">
              proactive research over coverage
            </div>
          </div>
        </>
      }
      contextualControls={
        <>
          <VaultMemoUpload
            onUploaded={() => {
              queryCapabilities().then(setCaps).catch(() => {});
              if (activeId === "analyst-memos") pick("analyst-memos");
            }}
          />
          <MetricPill label="answerable" value={caps ? `${totalReady}/${totalCaps}` : "loading"} />
          {running && <span className="tabular text-caos-2xs text-caos-accent caos-running">building answer</span>}
        </>
      }
      narrowContract={narrowContract}
    >
      <div className="flex-1 min-h-0 flex bg-caos-bg">
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <section className="shrink-0 border-b border-caos-border bg-caos-panel/40 px-4 py-2 relative">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted">
                {totalReady} of {totalCaps} questions ready
              </span>
            </div>
            <GroupLauncher
              groups={groups}
              cardsByGroup={cardsByGroup}
              openId={openGroup}
              onToggle={setOpenGroup}
              onPick={(id) => { setText(""); setOpenGroup(null); pick(id); }}
              onOpenChunk={(id, label) => setCite({ id, label })}
            />
          </section>

          {/* Layout F — the ask bar is anchored at the BOTTOM (order-last); the
              question tray lives in its own persistent band at the TOP of the
              canvas (above) so the analyst's menu of runnable questions is the
              first thing seen, not the auto-run demo answer. */}
          <section className="order-last shrink-0 border-t border-caos-border bg-caos-panel/55 px-4 py-2.5 relative">
            <div ref={composerRef} onBlur={onComposerBlur} className="relative">
              <div className="flex items-center gap-2 bg-caos-bg border border-caos-border rounded-md px-3 py-1.5 focus-within:border-caos-accent/70 transition-caos">
                <QueryMark small />
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={onInputKeyDown}
                  placeholder={`Route a question across coverage — ${totalReady || "…"} questions ready`}
                  aria-label="Query coverage"
                  role="combobox"
                  aria-expanded={suggestOpen}
                  aria-controls="query-suggest-listbox"
                  aria-activedescendant={suggestOpen && activeSuggest >= 0 ? suggestOptions[activeSuggest]?.key : undefined}
                  aria-autocomplete="list"
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
                {/* One-box unification (additive) — the metric-search lane as an
                    explicit secondary action. Enter stays walk-primary; this
                    button is the only way into the /nl metric lane, so intent is
                    never silently misrouted (RT-2026-07-07-26). A second click
                    while in-flight aborts (reads CANCEL). */}
                <button
                  type="button"
                  onClick={() => (metricBusy ? cancelMetric() : scanMetrics())}
                  disabled={!metricBusy && !text.trim()}
                  aria-label={metricBusy ? "Cancel metric scan" : "Scan metrics across coverage"}
                  title="Rank issuers across the metric store — e.g. 'which issuers are most levered'"
                  className="tabular text-caos-sm px-3 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {metricBusy ? "CANCEL" : "SCAN METRICS"}
                </button>
              </div>

              {suggestOpen && (
                <ul
                  id="query-suggest-listbox"
                  role="listbox"
                  aria-label="Question suggestions"
                  className="absolute left-0 right-0 bottom-full mb-1 z-20 bg-caos-panel border border-caos-border rounded-md overflow-hidden"
                  style={{ boxShadow: "var(--shadow-pop)" }}
                >
                  {historyRows.length > 0 && (
                    <li role="presentation" className="border-b border-caos-border/60 py-1">
                      <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted px-3 py-1" role="presentation">Recent</div>
                      <ul role="presentation">
                        {historyRows.map((h, i) => {
                          const idx = i;
                          const key = suggestOptions[idx]?.key;
                          return (
                            <li key={key} role="presentation">
                              <button
                                id={key}
                                type="button"
                                role="option"
                                aria-selected={activeSuggest === idx}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setText(h.text);
                                  setSearchOpen(false);
                                  pick(h.capId);
                                }}
                                onMouseEnter={() => setActiveSuggest(idx)}
                                className={`w-full text-left px-3 py-1.5 flex items-baseline gap-2 transition-caos focus-ring ${activeSuggest === idx ? "bg-caos-elevated/60" : "hover:bg-caos-elevated/60"}`}
                              >
                                <span className="tabular text-caos-sm text-caos-text truncate">&quot;{h.text}&quot;</span>
                                <span className="tabular text-caos-3xs text-caos-muted font-mono shrink-0">→ {h.capLabel}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  )}
                  {prompts.length > 0 && (
                    <li role="presentation" className="py-1">
                      <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted px-3 py-1" role="presentation">Runnable now</div>
                      <ul role="presentation">
                        {prompts.map((p, i) => {
                          const idx = historyRows.length + i;
                          const key = suggestOptions[idx]?.key;
                          return (
                            <li key={key} role="presentation">
                              <button
                                id={key}
                                type="button"
                                role="option"
                                aria-selected={activeSuggest === idx}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setSearchOpen(false);
                                  addToHistory(questionFor(p), p.id, p.label);
                                  pick(p.id);
                                }}
                                onMouseEnter={() => setActiveSuggest(idx)}
                                className={`w-full text-left px-3 py-1.5 flex items-baseline gap-2 transition-caos focus-ring ${activeSuggest === idx ? "bg-caos-elevated/60" : "hover:bg-caos-elevated/60"}`}
                              >
                                <span className="tabular text-caos-sm text-caos-text truncate">{questionFor(p)}</span>
                                <span className="tabular text-caos-3xs text-caos-muted font-mono shrink-0 truncate max-w-[45%]">{engineNote(p.id)}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* aria-live so screen readers announce Routing…/Routed/misses as
                they arrive; a routed/routing note reads neutral (accent/muted),
                only real misses and failures read as a warning. */}
            <div role="status" aria-live="polite" className={note ? "mt-2 flex items-center gap-2 flex-wrap" : "sr-only"}>
              {note && (
                <span className={`tabular text-caos-sm flex items-center gap-1 ${noteKind === "warn" ? "text-caos-warning" : "text-caos-muted"}`}>
                  {noteKind === "warn" ? (
                    <span aria-hidden>!</span>
                  ) : routing ? (
                    <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-caos-accent caos-running" />
                  ) : null}
                  <span className={noteKind === "warn" ? "" : "text-caos-text"}>{note}</span>
                </span>
              )}
              {routing && (
                <button
                  type="button"
                  onClick={cancelRoute}
                  className="tabular text-caos-2xs px-2 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring"
                >
                  Cancel
                </button>
              )}
              {suggest.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c.id)}
                  className="tabular text-caos-2xs px-2 py-0.5 rounded border border-caos-accent/50 text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring"
                >
                  {questionFor(c)}
                </button>
              ))}
            </div>
          </section>

          <InsightFeed
            brief={brief}
            loading={briefLoading}
            collapsed={briefCollapsed}
            onToggle={() => setBriefCollapsed((v) => !v)}
            onRefresh={() => { briefPolls.current = 0; loadBrief(true); }}
            onOpenWalk={(w) => { setBriefCollapsed(true); pick(w); }}
            onOpenChunk={(id, label) => setCite({ id, label })}
            onPin={pinInsight}
          />

          {graph && (
            <div className="shrink-0 px-4 py-3 border-b border-caos-border bg-caos-panel">
              <div className="flex items-center gap-2 flex-wrap">
                {/* The question is the lead; the mode is a small human-readable
                    tag (never the raw engine enum) after it. */}
                {activeCap && (
                  <span className="tabular text-caos-sm text-caos-text font-medium">{questionFor(activeCap)}</span>
                )}
                <span className="tabular text-caos-3xs uppercase tracking-wide text-caos-accent border border-caos-accent/40 bg-caos-accent/10 rounded px-1.5 py-px">
                  {capLabel(graph.capability_id)}
                </span>
                {running && <span className="tabular text-caos-2xs text-caos-muted caos-running">running</span>}
              </div>
              <h2 className="tabular text-caos-xl text-caos-text font-semibold mt-1 truncate" title={graph.title}>{graph.title}</h2>
              <p className="text-caos-md text-caos-text font-sans leading-normal mt-1">{synthesize(graph)}</p>
              {/* Q2 — the grounded AI answer sits under the deterministic synthesis
                  line: additive, cited, marked. Self-hides when no question is in play. */}
              <AiAnswer answer={answer} loading={answerLoading} onOpenChunk={(id, label) => setCite({ id, label })} />
              {/* Q3 — promote the overlay commentary out of the dock so model
                  observations ride beside the answer, not behind a click. */}
              {overlay?.commentary && (
                <div className="mt-2 rounded-md border px-3 py-1.5 print:hidden" style={{ borderColor: `${MODEL_HUE}33`, borderLeft: `2px solid ${MODEL_HUE}` }}>
                  <span className="tabular text-caos-3xs uppercase tracking-wider font-semibold" style={{ color: MODEL_HUE }}>Model note</span>
                  <p className="text-caos-xs text-caos-muted font-sans leading-relaxed mt-0.5">{overlay.commentary}</p>
                </div>
              )}
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
              <div ref={tablistRef} className="flex border border-caos-border rounded bg-caos-panel/40 p-0.5" role="tablist" aria-label="Result view" onKeyDown={onTabKeyDown}>
                {views.map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={activeView === v}
                    tabIndex={activeView === v ? 0 : -1}
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
                      // Seq guard: this lane runs up to 130s — if the analyst runs a
                      // different question meanwhile (run() clears overlay + bumps
                      // seq), the late overlay must not attach to the new graph.
                      const seq = runSeq.current;
                      queryOverlay(activeId)
                        .then((o) => {
                          if (seq !== runSeq.current) return;
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
              <Center text={running ? "Building the answer…" : "Open a card from the desk brief above, or ask a question to render its answer."} />
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

        {railCollapsed ? (
          <aside className="hidden lg:flex w-10 border-l border-caos-border bg-caos-panel flex-col items-center shrink-0 py-2 gap-2" aria-label="Report and evidence (collapsed)">
            <button type="button" onClick={() => setRailCollapsed(false)} aria-label="Open report panel" title="Open report / evidence" className="text-caos-muted hover:text-caos-text focus-ring rounded p-1">
              <svg viewBox="0 0 12 12" className="w-3 h-3 stroke-current" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 2.5 L4 6 L7.5 9.5" /></svg>
            </button>
            <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted" style={{ writingMode: "vertical-rl" }}>Report</span>
            {report.length > 0 && (
              <span className="tabular text-caos-3xs font-mono rounded-full px-1" style={{ color: MODEL_HUE, backgroundColor: `${MODEL_HUE}22` }}>{report.length}</span>
            )}
          </aside>
        ) : (
        <aside
          className="hidden lg:flex w-[320px] xl:w-[360px] border-l border-caos-border bg-caos-panel flex-col shrink-0"
          aria-label="Report and evidence"
        >
          <div className="shrink-0 flex items-center border-b border-caos-border">
            <div className="flex flex-1" role="tablist" aria-label="Right panel">
              {(["report", "evidence"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={railTab === t}
                  onClick={() => setRailTab(t)}
                  className={`flex-1 tabular text-caos-2xs uppercase tracking-wider py-2 flex items-center justify-center gap-1.5 transition-caos focus-ring ${
                    railTab === t ? "text-caos-text border-b-2 border-caos-accent" : "text-caos-muted hover:text-caos-text border-b-2 border-transparent"
                  }`}
                >
                  {t}
                  {t === "report" && report.length > 0 && (
                    <span className="tabular text-caos-3xs font-mono rounded-full px-1.5" style={{ color: MODEL_HUE, backgroundColor: `${MODEL_HUE}22` }}>{report.length}</span>
                  )}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setRailCollapsed(true)} aria-label="Collapse report panel" title="Collapse panel" className="shrink-0 px-2 text-caos-muted hover:text-caos-text focus-ring">
              <svg viewBox="0 0 12 12" className="w-3 h-3 stroke-current" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 2.5 L8 6 L4.5 9.5" /></svg>
            </button>
          </div>
          <div className="flex-1 min-h-0">
            {railTab === "report" ? (
              <ReportRail
                sections={report}
                onRemove={(id) => setReport((prev) => removeSection(prev, id))}
                onExport={() => setPrintMode("report")}
                onClear={() => setReport([])}
                onOpenChunk={(id, label) => setCite({ id, label })}
              />
            ) : (
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
            )}
          </div>
        </aside>
        )}
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

      {/* One-box unification — the "Scan metrics" result overlay. Reuses the
          Command Center /nl modal verbatim (QueryResultsModal), so the ranked
          table / evidence list / chart / caveats render identically on both
          surfaces. The citation chips call back into the shared `cite` state
          above, so the same CitationViewer backs both the walk and metric lanes.
          Walk stays primary (Enter); this modal is opened only by the explicit
          SCAN METRICS button (RT-2026-07-07-26 / 27). */}
      {metricOpen && (
        <QueryResultsModal
          question={text}
          res={metricRes}
          busy={metricBusy}
          err={metricErr}
          onClose={() => {
            setMetricOpen(false);
            if (metricBusy) cancelMetric();
          }}
          openCite={(id, label) => setCite({ id, label })}
        />
      )}
      <div className="sr-only" role="status" aria-live="polite">{metricLive}</div>

      {/* Committee print exhibits (display:none until window.print()). Only ONE
          print-root is live at a time — the per-graph exhibit by default, the
          multi-section research report while exporting — so print never doubles. */}
      {graph && printMode === "graph" && (
        <QueryPrintSheet
          graph={graph}
          question={activeCap ? questionFor(activeCap) : graph.title}
          engineNote={activeId ? engineNote(activeId) : ""}
          synthesis={synthesize(graph)}
        />
      )}
      {printMode === "report" && <QueryReportSheet sections={report} graph={graph} />}
    </ResponsiveShell>
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
