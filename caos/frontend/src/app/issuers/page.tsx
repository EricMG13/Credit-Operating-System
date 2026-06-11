"use client";

// Issuer Directory — the workspace hub, in the CAOS design language shared by
// the five concept sections: h-10 sub-header, dense tabular rows, panel chrome.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getIssuers, createIssuer } from "@/lib/api";
import type { Issuer } from "@/types/issuers";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { Panel } from "@/components/shared/Panel";

const SECTIONS = [
  { href: "/command", k: "A", label: "Command Center" },
  { href: "/pipeline", k: "B", label: "Pipeline" },
  { href: "/deepdive", k: "C", label: "Deep-Dive" },
  { href: "/model", k: "D", label: "Model Builder" },
  { href: "/reports", k: "E", label: "Report Studio" },
];

export default function IssuersPage() {
  return (
    <RequireAuth>
      <IssuersDirectory />
    </RequireAuth>
  );
}


function IssuersDirectory() {
  const router = useRouter();
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", ticker: "", industry: "", country: "" });

  useEffect(() => {
    getIssuers().then(setIssuers).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const issuer = await createIssuer(form);
    setIssuers((prev) => [...prev, issuer]);
    setShowForm(false);
    setForm({ name: "", ticker: "", industry: "", country: "" });
  };

  const cols = "grid grid-cols-[64px_minmax(220px,1.6fr)_1fr_1fr_120px_90px] items-center gap-x-3";

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-3 px-4">
        <span className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-bold" style={{ background: "var(--caos-accent)", color: "#0a0a0f" }}>C</span>
          <span className="text-[12px] font-semibold tracking-wide text-caos-text whitespace-nowrap">CREDIT OS</span>
          <span className="tabular text-[9px] text-caos-muted border border-caos-border rounded px-1 py-px">v2.2</span>
        </span>
        <div className="h-4 w-px bg-caos-border" />
        <span className="text-[11px] text-caos-text font-medium whitespace-nowrap">Issuer Directory</span>
        <span className="tabular text-[9.5px] text-caos-muted whitespace-nowrap truncate">
          {loading ? "loading…" : issuers.length + " issuers · US HY sleeve"}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {SECTIONS.map((s) => (
            <Link
              key={s.k}
              href={s.href}
              className="no-underline tabular text-[9.5px] px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 transition-caos whitespace-nowrap"
            >
              <span className="text-caos-accent mr-1">{s.k}</span>
              {s.label}
            </Link>
          ))}
        </div>
        <div className="h-4 w-px bg-caos-border" />
        <Link
          href="/upload"
          className="no-underline tabular text-[9px] px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos whitespace-nowrap"
        >
          UPLOAD DOCUMENTS
        </Link>
        <button
          onClick={() => setShowForm(true)}
          className="tabular text-[9px] px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos whitespace-nowrap"
        >
          + NEW ISSUER
        </button>
      </div>

      {/* directory */}
      <div className="flex-1 min-h-0 p-2">
        <Panel
          title="Issuer Register · coverage universe"
          className="h-full"
          right={<span className="tabular text-[9px] text-caos-muted">click a row to open its cockpit</span>}
        >
          {loading ? (
            <div className="px-3 py-3 text-[10.5px] text-caos-muted">Loading issuers…</div>
          ) : issuers.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
              <p className="text-caos-text/85 text-[12px] font-medium">No issuers yet</p>
              <p className="text-caos-muted text-[10.5px] max-w-xs">
                Add your first issuer, then upload its canonical documents (OM, Credit Agreement, LBO Model) to start a run.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-1 tabular text-[10px] px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
              >
                + NEW ISSUER
              </button>
            </div>
          ) : (
            <div className="text-[11px]">
              <div className={cols + " px-3 h-7 border-b border-caos-border sticky top-0 bg-caos-panel z-10"}>
                {["Ticker", "Issuer", "Industry", "Country", "Documents", ""].map((h, i) => (
                  <span key={i} className="tabular text-[9px] uppercase tracking-wider text-caos-muted">{h}</span>
                ))}
              </div>
              {issuers.map((issuer) => (
                <div
                  key={issuer.id}
                  onClick={() => router.push(`/issuers/${issuer.id}`)}
                  className={cols + " px-3 py-[7px] border-b border-caos-border/50 cursor-pointer transition-caos hover:bg-caos-elevated/60 group"}
                >
                  <span className="tabular text-caos-accent text-[10.5px]">
                    {issuer.ticker?.slice(0, 5).toUpperCase() || "—"}
                  </span>
                  <span className="text-caos-text text-[11px] truncate group-hover:text-white transition-caos">{issuer.name}</span>
                  <span className="text-caos-muted text-[10px] truncate">{issuer.industry || "—"}</span>
                  <span className="text-caos-muted text-[10px] truncate">{issuer.country || "—"}</span>
                  <span
                    onClick={(e) => { e.stopPropagation(); router.push("/upload"); }}
                    className="tabular text-[9px] text-caos-muted hover:text-caos-text border border-caos-border rounded px-1.5 py-0.5 w-fit transition-caos"
                  >
                    + UPLOAD
                  </span>
                  <span className="tabular text-[9px] text-caos-muted text-right group-hover:text-caos-accent transition-caos">OPEN →</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* create modal */}
      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(5,5,7,0.72)" }} onClick={() => setShowForm(false)}>
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="caos-enter bg-caos-panel border border-caos-border rounded-md w-full max-w-md overflow-hidden"
            style={{ boxShadow: "0 24px 80px -24px rgba(0,0,0,0.9)" }}
          >
            <div className="h-9 px-3 flex items-center gap-2 border-b border-caos-border bg-caos-elevated/60">
              <span className="tabular text-[11px] text-caos-text">New Issuer</span>
              <span className="tabular text-[8.5px] px-1.5 py-px rounded border border-caos-border text-caos-muted">registers to the coverage universe</span>
              <div className="flex-1" />
              <button type="button" onClick={() => setShowForm(false)} className="w-5 h-5 rounded border border-caos-border flex items-center justify-center text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos text-[10px]">✕</button>
            </div>
            <div className="p-3 flex flex-col gap-2.5">
              {([
                { key: "name", label: "Company name", required: true, ph: "e.g. Atlas Forge Industrials" },
                { key: "ticker", label: "Ticker / CUSIP", required: false, ph: "e.g. ATLF" },
                { key: "industry", label: "Industry", required: false, ph: "e.g. Industrials" },
                { key: "country", label: "Country", required: false, ph: "e.g. United States" },
              ] as { key: "name" | "ticker" | "industry" | "country"; label: string; required: boolean; ph: string }[]).map(({ key, label, required, ph }) => (
                <div key={key}>
                  <label className="block tabular text-[8.5px] uppercase tracking-wider text-caos-muted mb-1">{label}{required ? " ·" : ""}</label>
                  <input
                    required={required}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={ph}
                    className="w-full bg-caos-bg border border-caos-border rounded px-2.5 py-1.5 text-[10.5px] text-caos-text placeholder:text-caos-muted/50 outline-none focus:border-caos-accent/70 transition-caos"
                  />
                </div>
              ))}
            </div>
            <div className="px-3 pb-3 flex gap-2">
              <button type="submit" className="flex-1 tabular text-[10px] py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos">
                CREATE ISSUER
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-3 tabular text-[10px] py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos">
                CANCEL
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
