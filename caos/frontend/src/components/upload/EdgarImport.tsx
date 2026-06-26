"use client";

// Import from SEC EDGAR — the free, no-key covenant/legal source lane surfaced in
// the intake flow. Search filings → expand a filing's exhibits → vault the
// credit agreement / indenture as a primary source for the selected issuer.
// Mirrors the server provenance discipline: a search hit is a *pointer*
// (external · unverified) until it is vaulted (primary · vaulted).

import { useState } from "react";
import {
  edgarSearch,
  edgarExhibits,
  edgarVaultExhibit,
  type EdgarExhibit,
  type EdgarFilingHit,
  type EdgarVaultResult,
} from "@/lib/api";
import type { Issuer } from "@/types/issuers";
import { Dot } from "@/components/pipeline/atoms";
import { Panel } from "@/components/shared/Panel";
import { TextInput } from "@/components/shared/TextInput";

// Covenant-bearing forms: credit agreements (Ex-10.x) and indentures (Ex-4.x)
// attach to these, plus the covenant "Description of Notes" in S-1/S-4/424B.
const FORMS = "8-K,S-1,S-4,424B5,424B3,10-K";

function errInfo(err: unknown): { status?: number; detail?: string } {
  const e = err as { response?: { status?: number; data?: { detail?: string | { message?: string } } } };
  const d = e?.response?.data?.detail;
  return { status: e?.response?.status, detail: typeof d === "string" ? d : d?.message };
}

// CP-4 authority hierarchy → a tranche-style hue (governing docs read strongest).
function rankColor(rank: number | null): string {
  if (rank === 1) return "var(--tranche-1l)";
  if (rank === 2) return "var(--tranche-2l)";
  if (rank && rank >= 3) return "var(--caos-warning)";
  return "var(--caos-muted)";
}

export function EdgarImport({
  issuer,
  runMode,
  onVaulted,
}: {
  issuer: Issuer;
  runMode: string;
  onVaulted?: (r: EdgarVaultResult) => void;
}) {
  const [query, setQuery] = useState(`${issuer.name} credit agreement`);
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<EdgarFilingHit[] | null>(null);
  const [error, setError] = useState("");
  const [notConfigured, setNotConfigured] = useState(false);

  const [openAcc, setOpenAcc] = useState<string | null>(null);
  const [exhibits, setExhibits] = useState<Record<string, EdgarExhibit[] | "loading">>({});
  const [vaulting, setVaulting] = useState<string | null>(null);
  const [vaulted, setVaulted] = useState<Record<string, EdgarVaultResult>>({});

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setNotConfigured(false);
    setHits(null);
    setOpenAcc(null);
    try {
      setHits(await edgarSearch(query.trim(), FORMS));
    } catch (err) {
      const { status, detail } = errInfo(err);
      if (status === 503) setNotConfigured(true);
      else setError(detail || "EDGAR search failed.");
    } finally {
      setSearching(false);
    }
  };

  const toggleExhibits = async (hit: EdgarFilingHit) => {
    if (openAcc === hit.accession) {
      setOpenAcc(null);
      return;
    }
    setOpenAcc(hit.accession);
    if (!exhibits[hit.accession]) {
      setExhibits((m) => ({ ...m, [hit.accession]: "loading" }));
      try {
        const ex = await edgarExhibits(hit.cik, hit.accession);
        setExhibits((m) => ({ ...m, [hit.accession]: ex }));
      } catch (err) {
        setExhibits((m) => ({ ...m, [hit.accession]: [] }));
        setError(errInfo(err).detail || "Could not list exhibits.");
      }
    }
  };

  const vault = async (ex: EdgarExhibit) => {
    setVaulting(ex.url);
    setError("");
    try {
      const res = await edgarVaultExhibit(issuer.id, ex.url, runMode);
      setVaulted((v) => ({ ...v, [ex.url]: res }));
      onVaulted?.(res);
    } catch (err) {
      setError(errInfo(err).detail || "Vaulting failed.");
    } finally {
      setVaulting(null);
    }
  };

  return (
    <Panel
      title="Import from SEC EDGAR"
      right={<span className="tabular text-caos-xs text-caos-muted">free · primary source · no key</span>}
    >
      <div className="p-3 flex flex-col gap-2.5">
        <div className="flex gap-2">
          <TextInput
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Issuer + document, e.g. Atlas Forge credit agreement"
            aria-label="Search SEC EDGAR filings for this issuer"
            maxLength={200}
            className="flex-1 px-2.5 py-1.5 text-caos-lg"
          />
          <button
            onClick={search}
            disabled={searching || !query.trim()}
            className="focus-ring tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos disabled:opacity-40 flex items-center gap-1.5"
          >
            {searching ? <Dot sev="running" pulse /> : null}
            {searching ? "SEARCHING…" : "SEARCH EDGAR"}
          </button>
        </div>

        {notConfigured ? (
          <div
            className="rounded border px-3 py-2 text-caos-md leading-snug"
            style={{ borderColor: "rgba(245,165,36,0.4)", background: "rgba(245,165,36,0.07)", color: "var(--caos-warning)" }}
          >
            EDGAR is not configured. Set <span className="tabular">EDGAR_USER_AGENT</span> to a descriptive
            contact string server-side (SEC fair-access requires it). No key or paid service needed.
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="flex items-center gap-2">
            <Dot sev="critical" />
            <span className="text-caos-md" style={{ color: "var(--caos-critical-bright)" }}>{error}</span>
          </div>
        ) : null}

        {hits && hits.length === 0 ? (
          <div className="text-caos-md text-caos-muted px-1 py-2">No filings matched — try the issuer&apos;s legal name or a ticker.</div>
        ) : null}

        {hits && hits.length > 0 ? (
          <div className="rounded border border-caos-border overflow-hidden">
            {hits.map((hit) => {
              const ex = exhibits[hit.accession];
              const open = openAcc === hit.accession;
              return (
                <div key={hit.accession} className="border-b border-caos-border/50 last:border-b-0">
                  <button
                    onClick={() => toggleExhibits(hit)}
                    aria-expanded={open}
                    className="focus-ring w-full grid grid-cols-[58px_72px_1fr_70px] items-center gap-x-3 px-3 py-[7px] text-left transition-caos hover:bg-caos-elevated/60"
                  >
                    <span className="tabular text-caos-xs text-caos-accent">{hit.form}</span>
                    <span className="tabular text-caos-xs text-caos-muted">{hit.filed_date}</span>
                    <span className="text-caos-lg text-caos-text truncate">{hit.title}</span>
                    <span className="tabular text-caos-xs text-right text-caos-muted">{open ? "HIDE ▲" : "EXHIBITS ▾"}</span>
                  </button>

                  {open ? (
                    <div className="bg-caos-bg/40 border-t border-caos-border/50">
                      {ex === "loading" ? (
                        <div className="px-3 py-2 flex items-center gap-2 text-caos-sm text-caos-muted">
                          <Dot sev="running" pulse /> loading exhibits…
                        </div>
                      ) : ex && ex.length > 0 ? (
                        ex.map((doc) => {
                          const done = vaulted[doc.url];
                          return (
                            <div
                              key={doc.url}
                              className="grid grid-cols-[10px_1fr_120px_84px] items-center gap-x-2.5 px-3 py-[6px] border-b border-caos-border/40 last:border-b-0"
                            >
                              <span className="w-2 h-2 rounded-full" style={{ background: rankColor(doc.authority_rank) }} title={doc.authority_rank ? `Authority rank ${doc.authority_rank}` : "Unclassified"} />
                              <span className="text-caos-md text-caos-text truncate" title={doc.name}>{doc.name}</span>
                              <span className="tabular text-caos-xs text-caos-muted truncate">{doc.doc_label}</span>
                              {done ? (
                                <span
                                  className="tabular text-caos-xs text-right flex items-center justify-end gap-1"
                                  title={done.chunks_created === 0 ? "No extractable text (scanned/encrypted?) — vaulted but not searchable or analysed." : undefined}
                                  style={{ color: done.chunks_created === 0 ? "var(--caos-warning)" : "var(--caos-success)" }}
                                >
                                  <Dot sev={done.chunks_created === 0 ? "warning" : "ok"} /> {done.chunks_created === 0 ? "0 ch — no text" : `${done.chunks_created} ch`}
                                </span>
                              ) : (
                                <button
                                  onClick={() => vault(doc)}
                                  disabled={vaulting === doc.url}
                                  aria-label={`Vault ${doc.doc_label} (${doc.name}) for this issuer`}
                                  className="focus-ring tabular text-caos-xs py-[3px] rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos disabled:opacity-40"
                                >
                                  {vaulting === doc.url ? "VAULTING…" : "VAULT →"}
                                </button>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-3 py-2 text-caos-sm text-caos-muted">No exhibits listed for this filing.</div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="tabular text-caos-2xs text-caos-muted leading-snug">
          Vaulted exhibits become E-xx-eligible primary sources for {issuer.name} — run the legal route to interpret covenants.
        </div>
      </div>
    </Panel>
  );
}
