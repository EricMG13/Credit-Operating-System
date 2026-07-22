"use client";

import { useEffect, useMemo, useState } from "react";
import { SourceRef } from "@/components/ui/SourceRef";
import { getChunk, getQA, toErrorMessage, type AlertEventDTO } from "@/lib/api";
import type { QAReportDTO } from "@/lib/engine/types";
import type { ChunkDTO } from "@/lib/query/types";
import { explicitAlertChunkIds } from "./usePersistedMonitorController";

type AlertEvidenceTarget =
  | { kind: "chunk"; id: string }
  | { kind: "run"; id: string; findingId: string | null }
  | { kind: "unavailable"; reason: string };

function findingIdFromEvidence(event: AlertEventDTO): string | null {
  const detail = event.evidence.detail;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const value = (detail as Record<string, unknown>).finding_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function primaryAlertEvidence(event: AlertEventDTO): AlertEvidenceTarget {
  const chunkId = explicitAlertChunkIds(event)[0];
  if (chunkId) return { kind: "chunk", id: chunkId };
  if (event.run_id?.trim()) {
    return { kind: "run", id: event.run_id.trim(), findingId: findingIdFromEvidence(event) };
  }
  return {
    kind: "unavailable",
    reason: "No explicit persisted chunk or governed run id accompanies this alert event.",
  };
}

export function AlertEvidence({ event, phone = false }: { event: AlertEventDTO; phone?: boolean }) {
  const target = useMemo(() => primaryAlertEvidence(event), [event]);
  const identity = target.kind === "unavailable"
    ? `unavailable:${target.reason}`
    : `${target.kind}:${target.id}:${target.kind === "run" ? target.findingId ?? "" : ""}`;
  const [chunk, setChunk] = useState<ChunkDTO | null>(null);
  const [runEvidence, setRunEvidence] = useState<QAReportDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChunk(null);
    setRunEvidence(null);
    setLoading(false);
    setError(null);
  }, [identity]);

  if (target.kind === "unavailable") {
    return <SourceRef source={{ state: "unavailable", reason: target.reason }} />;
  }

  const open = async () => {
    if (loading || chunk || runEvidence) return;
    setLoading(true);
    setError(null);
    try {
      if (target.kind === "chunk") setChunk(await getChunk(target.id));
      else setRunEvidence(await getQA(target.id));
    } catch (reason) {
      setError(toErrorMessage(reason, "The persisted alert evidence could not be loaded"));
    } finally {
      setLoading(false);
    }
  };
  const finding = target.kind === "run" && target.findingId && runEvidence
    ? runEvidence.findings.find((item) => item.finding_id === target.findingId) ?? null
    : null;
  const targetClass = phone ? "inline-flex min-h-11 min-w-11 items-center caos-target" : "inline-flex min-h-8 items-center caos-target";
  const label = target.kind === "chunk" ? "Open persisted source" : "Open persisted run evidence";
  return (
    <div className="mt-1 grid gap-1">
      <SourceRef className={targetClass} source={{ state: "ready", id: target.kind === "chunk" ? target.id : `run:${target.id}`, onOpen: () => void open() }}>{label}</SourceRef>
      {loading ? <span role="status" className="text-caos-2xs text-caos-muted">Loading evidence…</span> : null}
      {error ? <span role="alert" className={`${phone ? "text-caos-xs" : "text-caos-2xs"} text-caos-warning`}>Evidence unavailable · {error}</span> : null}
      {chunk ? <details className={`${phone ? "text-caos-xs" : "text-caos-2xs"} text-caos-muted`}><summary className={`${phone ? "min-h-11" : "min-h-8"} inline-flex cursor-pointer items-center rounded focus-ring caos-target`}>{chunk.doc} · source extract</summary><p className="mt-1 whitespace-pre-wrap leading-snug text-caos-text">{chunk.text}</p></details> : null}
      {runEvidence ? (
        <details className={`${phone ? "text-caos-xs" : "text-caos-2xs"} text-caos-muted`}>
          <summary className={`${phone ? "min-h-11" : "min-h-8"} inline-flex cursor-pointer items-center rounded focus-ring caos-target`}>
            Run {runEvidence.run_id} · QA {runEvidence.qa_status} · committee {runEvidence.committee_status}
          </summary>
          {target.kind === "run" && target.findingId ? (
            finding
              ? <p className="mt-1 whitespace-pre-wrap leading-snug text-caos-text">{finding.finding_id} · {finding.severity} · {finding.description}</p>
              : <p className="mt-1 text-caos-warning">Finding {target.findingId} is not present in the governed run QA report.</p>
          ) : <p className="mt-1 text-caos-text">Persisted run QA status: {runEvidence.qa_status}.</p>}
        </details>
      ) : null}
    </div>
  );
}
