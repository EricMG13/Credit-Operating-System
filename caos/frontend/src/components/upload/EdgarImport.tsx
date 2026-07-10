"use client";

// EDGAR source intake: paste the source URL, vault it through the same backend
// path as an upload, and make it E-xx-eligible.

import { useState } from "react";
import { edgarVaultUrls, type EdgarVaultResult } from "@/lib/api";
import type { Issuer } from "@/types/issuers";
import { Dot } from "@/components/pipeline/atoms";
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
    try {
      const res = await edgarVaultUrls(issuer.id, u, runMode);
      setResults(res);
      res.forEach((r) => onVaulted?.(r));
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
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && vault()}
            placeholder="https://www.sec.gov/Archives/edgar/data/..."
            aria-label="Public EDGAR document URLs"
            className="flex-1 px-2.5 py-1.5 text-caos-lg"
          />
          <button
            onClick={vault}
            disabled={vaulting || !url.trim()}
            className="focus-ring tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos disabled:opacity-40 flex items-center gap-1.5"
          >
            {vaulting ? <Dot sev="running" pulse /> : null}
            {vaulting ? "VAULTING…" : "VAULT URL"}
          </button>
        </div>

        {notConfigured ? (
          <div className="rounded border px-3 py-2 text-caos-md leading-snug" style={{ borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 7%, transparent)", color: "var(--caos-warning)" }}>
            EDGAR is not configured. Set <span className="tabular">EDGAR_USER_AGENT</span> server-side.
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

        <div className="tabular text-caos-2xs text-caos-muted leading-snug">
          Public issuer URLs and private drag/drop files can be used together for {issuer.name}.
        </div>
      </div>
    </Panel>
  );
}
