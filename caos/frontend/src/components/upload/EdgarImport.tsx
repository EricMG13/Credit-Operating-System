"use client";

// EDGAR source intake: paste the source URL, vault it through the same backend
// path as an upload, and make it E-xx-eligible.

import { useState } from "react";
import { edgarVaultUrls, type EdgarVaultResult } from "@/lib/api";
import type { Issuer } from "@/types/issuers";
import { Dot } from "@/components/pipeline/atoms";
import { ActionReason } from "@/components/shared/ActionReason";
import { Panel } from "@/components/shared/Panel";
import { TextInput } from "@/components/shared/TextInput";

function errInfo(err: unknown): { status?: number; detail?: string } {
  const e = err as { response?: { status?: number; data?: { detail?: string | { message?: string } } } };
  const d = e?.response?.data?.detail;
  return { status: e?.response?.status, detail: typeof d === "string" ? d : d?.message };
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
  const [url, setUrl] = useState("");
  const [vaulting, setVaulting] = useState(false);
  const [results, setResults] = useState<EdgarVaultResult[]>([]);
  // M-12: which URLs were dropped from a partial batch (some succeeded, some
  // didn't) — previously invisible, so 2 silent failures out of 5 URLs looked
  // identical to a clean 5/5.
  const [failed, setFailed] = useState<{ url: string; reason: string }[]>([]);
  const [error, setError] = useState("");
  const [notConfigured, setNotConfigured] = useState(false);

  const vault = async () => {
    const u = url.trim();
    // Guard vaulting in the handler, not just the button: the Enter key (onKeyDown)
    // calls vault() directly, so a second quick Enter would fire a duplicate batch
    // (double-vaulted exhibits → duplicate chunks feeding E-xx evidence).
    if (!u || vaulting) return;
    setVaulting(true);
    setError("");
    setNotConfigured(false);
    setResults([]);
    setFailed([]);
    try {
      const res = await edgarVaultUrls(issuer.id, u, runMode);
      setResults(res.ok);
      setFailed(res.failed);
      // The parent moves an EDGAR success onto the same durable result surface
      // as a dropped file. Keep this component's own list too until that state
      // transition occurs, so it remains useful when embedded elsewhere.
      res.ok.forEach((r) => onVaulted?.(r));
    } catch (err) {
      const { status, detail } = errInfo(err);
      if (status === 503) setNotConfigured(true);
      else setError(detail || "EDGAR URL vaulting failed.");
    } finally {
      setVaulting(false);
    }
  };

  return (
    <Panel
      title="Public / EDGAR URL"
      right={<span className="tabular text-caos-xs text-caos-muted">comma-separated latest issuer files</span>}
    >
      <div className="p-3 flex flex-col gap-2.5">
        <div className="flex gap-2">
          <TextInput
            type="url"
            name="edgar-document-urls"
            autoComplete="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && vault()}
            placeholder="https://www.sec.gov/Archives/edgar/data/…"
            aria-label="Public EDGAR document URLs"
            className="flex-1 px-2.5 py-1.5 text-caos-lg"
          />
          <ActionReason
            onClick={vault}
            reason={vaulting ? "Vaulting…" : !url.trim() ? "Enter a URL first" : null}
            className="focus-ring tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos aria-disabled:opacity-40 flex items-center gap-1.5"
          >
            {vaulting ? <Dot sev="running" pulse /> : null}
            {vaulting ? "VAULTING…" : "VAULT URL"}
          </ActionReason>
        </div>

        {notConfigured ? (
          <div className="rounded border px-3 py-2 text-caos-md leading-snug" style={{ borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 7%, transparent)", color: "var(--caos-warning)" }}>
            SEC filing import is unavailable. Ask a workspace administrator to configure SEC access.
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="flex items-center gap-2">
            <Dot sev="critical" />
            <span className="text-caos-md" style={{ color: "var(--caos-critical-bright)" }}>{error}</span>
          </div>
        ) : null}

        {results.map((result) => (
          <div key={result.document_id} className="flex items-center gap-2 rounded border border-caos-border px-3 py-2">
            <Dot sev={result.chunks_created === 0 ? "warning" : "ok"} />
            <span className="text-caos-md text-caos-text truncate flex-1">{result.message}</span>
            <span className="tabular text-caos-xs text-caos-muted">{result.chunks_created} ch</span>
          </div>
        ))}

        {failed.length ? (
          <div role="alert" className="rounded border px-3 py-2 flex flex-col gap-1" style={{ borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 7%, transparent)" }}>
            <span className="tabular text-caos-md" style={{ color: "var(--caos-warning)" }}>
              vaulted {results.length}/{results.length + failed.length} — {failed.length} failed
            </span>
            {failed.map((f, i) => (
              <span key={`${f.url}-${i}`} className="tabular text-caos-xs text-caos-muted truncate" title={f.reason}>
                {f.url} — {f.reason}
              </span>
            ))}
          </div>
        ) : null}

        <div className="tabular text-caos-2xs text-caos-muted leading-snug">
          Public issuer URLs and private drag/drop files can be used together for {issuer.name}{issuer.name.endsWith(".") ? "" : "."}
        </div>
      </div>
    </Panel>
  );
}
