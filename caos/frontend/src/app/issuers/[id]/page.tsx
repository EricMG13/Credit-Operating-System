"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getConclusions,
  getDagRunOutputs,
  getIssuer,
  getSourceDocument,
  listDagRuns,
  listIssuerDocuments,
  triggerRun,
} from "@/lib/api";
import { CreditCockpit } from "@/components/cockpit/CreditCockpit";
import { GlobalNavBar } from "@/components/nav/GlobalNavBar";
import { WorkflowStageHeader } from "@/components/nav/WorkflowStageHeader";
import { useIssuerStore } from "@/store/issuer";
import { useAnalysisStore } from "@/store/analysis";
import { useSelectionStore } from "@/store/selection";
import type { Issuer } from "@/types/issuers";
import type { AgentOutputs } from "@/types/agents";

/** Reshape flat AgentOutput[] rows → nested AgentOutputs shape for charts. */
function buildAgentOutputs(
  rows: { module_id: string; output: Record<string, unknown> | null; blocked_reason?: string }[]
): AgentOutputs {
  const byModule: Record<string, Record<string, unknown> | null> = {};
  rows.forEach((r) => {
    byModule[r.module_id] = r.output;
  });
  return {
    cp0: byModule["CP-0"] as AgentOutputs["cp0"],
    cp1: byModule["CP-1"] as AgentOutputs["cp1"],
    cp2: byModule["CP-2"] as AgentOutputs["cp2"],
    cp3: byModule["CP-3"] as AgentOutputs["cp3"],
    cp4: byModule["CP-4"] as AgentOutputs["cp4"],
    cp4c: byModule["CP-4C"] as AgentOutputs["cp4c"],
    cp6e: byModule["CP-6E"] as AgentOutputs["cp6e"],
    blocked_modules: rows.filter((r) => r.blocked_reason).map((r) => r.module_id),
    errors: [],
  };
}

import { RequireAuth } from "@/components/shared/RequireAuth";

export default function IssuerPage() {
  return (
    <RequireAuth>
      <IssuerPageInner />
    </RequireAuth>
  );
}

function IssuerPageInner() {
  const { id } = useParams<{ id: string }>();
  const [issuer, setIssuer] = useState<Issuer | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const { dagRun, setDagRun, agentOutputs, setAgentOutputs } = useIssuerStore();
  const { setActiveDoc, setConclusions } = useAnalysisStore();
  const clearSelection = useSelectionStore((s) => s.clear);

  const loadOutputs = async (runId: string) => {
    try {
      const rows = await getDagRunOutputs(runId);
      setAgentOutputs(buildAgentOutputs(rows));
    } catch (_) {
      /* outputs not ready yet */
    }
  };

  useEffect(() => {
    clearSelection();
    getIssuer(id).then(setIssuer).finally(() => setLoading(false));
    getSourceDocument(id).then(setActiveDoc).catch(() => {});
    getConclusions(id).then(setConclusions).catch(() => {});
    listDagRuns(id).then((runs) => {
      if (!runs.length) return;
      const latest = runs[0];
      setDagRun(latest);
      if (["COMPLETED", "BLOCKED"].includes(latest.status)) loadOutputs(latest.dag_run_id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Poll while RUNNING — fetch outputs on completion
  useEffect(() => {
    if (!dagRun || ["COMPLETED", "BLOCKED", "FAILED"].includes(dagRun.status)) return;
    const t = setTimeout(async () => {
      const updated = await listDagRuns(id);
      if (!updated.length) return;
      const latest = updated[0];
      setDagRun(latest);
      if (["COMPLETED", "BLOCKED"].includes(latest.status)) await loadOutputs(latest.dag_run_id);
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dagRun, id]);

  const running = dagRun?.status === "RUNNING";
  const cp0 = agentOutputs?.cp0 as { source_quality?: string; confidence?: number } | undefined;

  if (loading) return <div className="p-8 text-caos-muted text-sm">Loading...</div>;
  if (!issuer) return <div className="p-8 text-red-400 text-sm">Issuer not found.</div>;

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      <GlobalNavBar outputs={agentOutputs} running={!!running} />
      <WorkflowStageHeader
        active="Diligence"
        sourceQuality={cp0?.source_quality}
        confidence={cp0?.confidence}
      />

      {/* Issuer sub-bar */}
      <header className="flex items-center gap-4 px-6 py-2.5 border-b border-caos-border bg-caos-panel shrink-0">
        <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-sm transition-caos">
          ← Directory
        </Link>
        <div className="h-4 w-px bg-caos-border" />
        <h1 className="text-white font-semibold">{issuer.name}</h1>
        {issuer.ticker && (
          <span className="tabular text-xs text-caos-muted bg-caos-elevated px-2 py-0.5 rounded">
            {issuer.ticker}
          </span>
        )}
        {issuer.industry && <span className="text-xs text-caos-muted">{issuer.industry}</span>}
        <div className="flex-1" />
        {dagRun && (
          <span
            className={`tabular text-xs px-2 py-1 rounded font-medium ${
              dagRun.status === "COMPLETED"
                ? "bg-emerald-900/50 text-emerald-400"
                : dagRun.status === "RUNNING"
                ? "bg-blue-900/50 text-blue-400 caos-running"
                : dagRun.status === "BLOCKED"
                ? "bg-red-900/50 text-red-400"
                : dagRun.status === "FAILED"
                ? "bg-orange-900/50 text-orange-400"
                : "bg-caos-elevated text-caos-muted"
            }`}
          >
            {dagRun.status} · {dagRun.run_type}
          </span>
        )}
        <button
          disabled={triggering || running}
          onClick={async () => {
            setTriggering(true);
            try {
              // Pick the most recently uploaded document for this issuer as
              // the run trigger — CP-0 uses it to decide FULL_RUN vs DELTA_RUN.
              const docs = await listIssuerDocuments(id);
              if (!docs.length) {
                alert(
                  "Upload at least one source document (OM, Credit Agreement, " +
                  "LBO Model, or Interim Report) before triggering a run."
                );
                return;
              }
              const run = await triggerRun(id, docs[0].id);
              setDagRun(run);
            } catch (err) {
              const detail = (err as { response?: { data?: { detail?: string } } })
                ?.response?.data?.detail;
              alert("Run failed to start: " + (detail || (err as Error)?.message || "backend unavailable"));
            } finally {
              setTriggering(false);
            }
          }}
          className="px-3 py-1.5 bg-caos-accent hover:bg-blue-500 disabled:opacity-40 text-white rounded text-xs font-medium transition-caos"
        >
          {triggering ? "Starting…" : running ? "Running…" : "⚡ Run Analysis"}
        </button>
      </header>

      {/* Main cockpit */}
      <div className="flex-1 overflow-hidden">
        <CreditCockpit issuerId={id} agentOutputs={agentOutputs} />
      </div>
    </div>
  );
}
