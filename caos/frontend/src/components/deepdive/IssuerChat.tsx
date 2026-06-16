"use client";

// ATLF issuer Q&A chat (port of design bundle concept-c-chat.jsx).
// Launched from the module output panel header; grounded in run #2641 module
// outputs. The grounding context travels as the first user message; the
// backend /api/chat/issuer endpoint forwards the conversation to Claude.

import { useEffect, useRef, useState } from "react";
import { TextInput } from "@/components/shared/TextInput";
import { askIssuer, type ChatMessage } from "@/lib/api";
import { CAPACITY, CAPSTACK, COVENANTS, DEAL, DEBATE, RECOVERY, SIZING, TRIGGERS } from "@/lib/reports/deal";
import { DRIVERS, MODULES } from "@/lib/pipeline/data";
import { MODULE_OUTPUTS, type OutSection } from "@/lib/deepdive/module-outputs";
import { EVIDENCE } from "@/lib/reports/evidence";
import { useEvidenceSync } from "@/lib/evidence-sync";
import { Dot } from "@/components/pipeline/atoms";

export function caosChatContext(tab: string, focusEv?: string | null): string {
  const mod = MODULES.find((m) => m.id === tab);
  const out = MODULE_OUTPUTS[tab];
  const flat = (s: OutSection): string => {
    if (s.type === "table") return s.title + " — " + s.rows.map((r) => r.join(" | ")).join(" ; ");
    if (s.type === "flags") return s.title + " — " + s.items.map((f) => "[" + f.sev + "] " + f.text).join(" ; ");
    return s.title + " — " + s.body;
  };
  const lines = [
    "You are the Credit OS analyst assistant. You answer follow-up questions about ONE issuer for a credit analyst, grounded ONLY in the module outputs below (run #2641, all figures mock).",
    "Style: terse desk-note tone, under 150 words, plain text (no markdown headers). Cite module codes (CP-x) and evidence ids (E-xx) where they support a point. If the answer isn't in the data, say so and name the module that would produce it. Never invent figures.",
    "",
    "ISSUER: " + DEAL.name + " (" + DEAL.code + ") — " + DEAL.sector + ". " + DEAL.sponsor + ". Rating " + DEAL.rating + ". LTM adj. EBITDA $" + DEAL.ebitda + "M, net leverage " + DEAL.netLev + "x.",
    "DEAL: " + DEAL.deal + ".",
    "THESIS (CP-6A): " + DEBATE.thesis,
    "IC VERDICT: " + DEBATE.bias + ". Single greatest uncertainty: " + DEBATE.uncertainty,
    "CHAIR MEMO: " + DEBATE.memo,
    "SIZING (CP-6E): " + SIZING.decision + " — initial " + SIZING.initial + ", max " + SIZING.max + ", entry " + SIZING.entry + ". Constraint: " + SIZING.constraint,
    "CLEARANCE (CP-5): CONDITIONAL — QA-117 (HIGH) open, citation E-44 page mismatch; committee pack held, debate verdict stands ex-E-44.",
    "CAPITAL STRUCTURE ($M claims): " + CAPSTACK.map((c) => c.cls + " " + c.claim).join(", ") + ".",
    "RECOVERY (CP-3B): " + RECOVERY.map((s) => s.scen + " " + s.mult + "×$" + s.ebitda + "M=$" + s.ev + "M EV").join("; ") + ". Claims 1L $1,970 / 2L $900 / Sub $400. Market-implied 2L recovery ≈38% at px 96.4.",
    "COVENANTS (CP-4/4C): " + COVENANTS.map((c) => c.name + " (agg " + c.agg + "/10, " + c.headroom + ")").join("; ") + ". Day-one incremental $" + CAPACITY.incDebt + "M; RP usable $" + CAPACITY.rpToday + "M; add-backs " + CAPACITY.addbackPct + "% of adj. Nearest pressure: " + CAPACITY.nearest,
    "TRIGGERS (CP-MON): " + TRIGGERS.map((t) => t.id + " " + t.text + " → " + t.owner).join("; "),
    "EVIDENCE DRIVERS (CP-5B): " + DRIVERS.map((d) => "#" + d.n + " " + d.driver + " [" + d.status + ", conf " + Math.round(d.conf * 100) + "%]").join("; "),
    "",
    "USER IS CURRENTLY VIEWING: " + tab + (mod ? " — " + mod.name : "") + ".",
  ];

  // Shared state from the cross-pane Evidence Sync: ground the answer in the
  // exact evidence the analyst is pointing at, so deictic questions ("is this a
  // problem?", "explain it") resolve to the right citation.
  const ev = focusEv ? EVIDENCE[focusEv] : null;
  if (focusEv && ev) {
    const hit = ev.excerpt.find((e) => e.hit) || ev.excerpt[0];
    lines.push(
      "ANALYST IS POINTING AT EVIDENCE " + focusEv + " — " + ev.section +
        " · " + ev.doc + (ev.page ? " p." + ev.page : "") +
        " · extracted by " + ev.module + " · status " + ev.status +
        (ev.qa ? " · QA: " + ev.qa : "") +
        (hit ? '. Cited passage: "' + hit.t.slice(0, 280) + '"' : "") +
        '. If the question says "this"/"it"/"that", it most likely refers to this.'
    );
  }
  if (out) lines.push("CURRENT MODULE OUTPUTS:\n" + out.sections.map(flat).join("\n"));
  return lines.join("\n");
}

const CAOS_CHAT_KEY = "caos-chat-atlf-2641";
const CAOS_CHAT_STARTERS = [
  "Why is clearance conditional?",
  "Summarize the bear case in 3 bullets",
  "What trips trigger T-1?",
  "Is +388bps enough for the priming risk?",
];

interface Msg extends ChatMessage {
  err?: boolean;
}

export function IssuerChat({ tab, onClose }: { tab: string; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try { return JSON.parse(localStorage.getItem(CAOS_CHAT_KEY) || "[]") || []; } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Evidence Sync is hover-transient; keep the most recent focused evidence so
  // the assistant stays grounded in it after the pointer moves to the input.
  const { active } = useEvidenceSync();
  const [focusEv, setFocusEv] = useState<string | null>(null);
  useEffect(() => { if (active) setFocusEv(active); }, [active]);

  useEffect(() => { try { localStorage.setItem(CAOS_CHAT_KEY, JSON.stringify(msgs)); } catch {} }, [msgs]);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, busy]);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const send = async (text?: string) => {
    const q = (text || input).trim();
    if (!q || busy) return;
    setInput("");
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setBusy(true);
    try {
      const payload: ChatMessage[] = [
        { role: "user", content: caosChatContext(tab, focusEv) },
        { role: "assistant", content: "Understood. I'll answer strictly from run #2641 outputs for ATLF, citing CP-x / E-xx." },
        ...next.slice(-12).map(({ role, content }) => ({ role, content })),
      ];
      const reply = await askIssuer(payload);
      setMsgs((m) => [...m, { role: "assistant", content: String(reply || "").trim() || "(no response)" }]);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        || (e as Error)?.message || "rate-limited or offline";
      setMsgs((m) => [...m, { role: "assistant", content: "Chat call failed (" + detail + "). Try again.", err: true}]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal={false}
      aria-label={DEAL.code + " · Issuer Q&A"}
      className="fixed bottom-3 right-3 z-30 caos-enter flex flex-col bg-caos-panel border border-caos-accent/60 rounded-md overflow-hidden"
      style={{ width: 408, height: 560, maxHeight: "78vh", boxShadow: "0 20px 64px -16px rgba(0,0,0,0.9), 0 0 0 1px rgba(79,140,255,0.12)" }}
    >
      <div className="h-9 shrink-0 px-3 flex items-center gap-2 border-b border-caos-border bg-caos-elevated/70">
        <span className="text-caos-accent text-caos-2xl">✦</span>
        <span className="tabular text-caos-xl text-caos-text whitespace-nowrap">{DEAL.code} · Issuer Q&A</span>
        <span className="tabular text-caos-2xs px-1.5 py-px rounded border border-caos-border text-caos-muted whitespace-nowrap">grounded in RUN #2641 · viewing {tab}</span>
        <div className="flex-1"></div>
        {msgs.length ? (
          <button onClick={() => setMsgs([])} title="Clear conversation" className="text-caos-muted hover:text-caos-text transition-caos text-caos-xl">⌫</button>
        ) : null}
        <button onClick={onClose} title="Close chat" className="w-5 h-5 rounded border border-caos-border flex items-center justify-center text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos text-caos-md">✕</button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto px-3 py-3 flex flex-col gap-2.5 bg-caos-bg">
        {!msgs.length ? (
          <div className="flex flex-col gap-2">
            <div className="text-caos-md text-caos-muted leading-relaxed">
              Ask follow-up questions about Atlas Forge — answers cite the module outputs (CP-x) and evidence (E-xx) from this run. All figures mock.
            </div>
            <div className="flex flex-col gap-1.5 mt-1">
              {CAOS_CHAT_STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="text-left tabular text-caos-md px-2.5 py-1.5 rounded border border-caos-border text-caos-text/85 hover:border-caos-accent/60 hover:bg-caos-elevated/60 transition-caos">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={"max-w-[88%] rounded px-2.5 py-2 text-caos-lg leading-relaxed whitespace-pre-wrap border " + (m.role === "user" ? "self-end text-caos-text" : "self-start text-caos-text/90")}
            style={m.role === "user"
              ? { background: "rgba(79,140,255,0.10)", borderColor: "rgba(79,140,255,0.4)" }
              : { background: "var(--caos-panel)", borderColor: m.err ? "rgba(245,165,36,0.5)" : "var(--caos-border)" }}
          >
            {m.role === "assistant" ? (
              <div className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-1 flex items-center gap-1">
                <span className="text-caos-accent">✦</span>Credit OS
              </div>
            ) : null}
            {m.content}
          </div>
        ))}
        {busy ? (
          <div className="self-start rounded px-2.5 py-2 border border-caos-border bg-caos-panel flex items-center gap-1.5">
            <Dot sev="running" pulse />
            <span className="tabular text-caos-sm text-caos-muted">querying run outputs…</span>
          </div>
        ) : null}
      </div>

      {focusEv && EVIDENCE[focusEv] ? (
        <div className="shrink-0 border-t border-caos-border bg-caos-elevated/40 px-2.5 py-1 flex items-center gap-1.5">
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-accent shrink-0">In focus</span>
          <span className="tabular text-caos-sm text-caos-accent shrink-0">{focusEv}</span>
          <span className="text-caos-sm text-caos-muted truncate">{EVIDENCE[focusEv].section}</span>
          <div className="flex-1" />
          <button
            onClick={() => setFocusEv(null)}
            title="Clear focus context"
            aria-label="Clear focus context"
            className="shrink-0 rounded text-caos-muted hover:text-caos-text transition-caos text-caos-md focus-ring"
          >
            ✕
          </button>
        </div>
      ) : null}

      <div className="shrink-0 border-t border-caos-border bg-caos-panel px-2.5 py-2 flex items-center gap-2">
        <TextInput
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={"Ask about ATLF — e.g. recovery, covenants, " + tab + "…"}
          aria-label="Ask a question about this issuer"
          maxLength={600}
          className="flex-1 px-2.5 py-1.5 text-caos-lg"
        />
        <button
          onClick={() => send()}
          disabled={busy || !input.trim()}
          title="Send"
          className="shrink-0 w-8 h-8 rounded flex items-center justify-center transition-caos disabled:opacity-40 text-[13px]"
          style={{ background: "var(--caos-accent)", color: "var(--caos-bg)" }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
