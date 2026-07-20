"use client";

import { useMemo } from "react";
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import type { LiveEvidence } from "@/lib/engine/useLiveRun";
import { buildReports } from "@/lib/reports/builders";

export function PipelineEvidenceModal({
  id,
  live,
  isLiveRun,
  onClose,
}: {
  id: string;
  live?: Record<string, LiveEvidence>;
  isLiveRun: boolean;
  onClose: () => void;
}) {
  const reports = useMemo(() => buildReports(), []);
  return <EvidenceModal id={id} reports={reports} live={live} isLiveRun={isLiveRun} onClose={onClose} />;
}
