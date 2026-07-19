import { useEffect, useState } from "react";
import {
  analysisApi,
  type AnalysisArtifactRefs,
  type AnalysisSurfaceName,
  type InsightArtifact,
} from "@/lib/analysis-workbench";

type SurfaceInsightOptions = {
  surface: AnalysisSurfaceName;
  kind: string;
  subjectRefs: Partial<AnalysisArtifactRefs>;
  loadingMessage: string;
  emptyMessage: string;
  errorMessage: string;
};

const isReadyInsight = (insight: InsightArtifact) => insight.status === "ready" || insight.status === "ratified";

export function useSurfaceInsight(contextId: string | null | undefined, options: SurfaceInsightOptions) {
  const [insight, setInsight] = useState<InsightArtifact | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { surface, kind, subjectRefs, loadingMessage, emptyMessage, errorMessage } = options;
  useEffect(() => {
    if (!contextId) return;
    let alive = true;
    analysisApi.listInsights(contextId, { surface, kind, limit: 20 })
      .then((page) => { if (alive) setInsight(page.current); })
      .catch(() => { if (alive) setMessage(emptyMessage); });
    return () => { alive = false; };
  }, [contextId, emptyMessage, kind, surface]);
  const generate = async () => {
    if (!contextId) return;
    setMessage(loadingMessage);
    try {
      const created = await analysisApi.createInsight(contextId, { surface, kind, subject_refs: subjectRefs, force: Boolean(insight) });
      if (isReadyInsight(created)) setInsight(created);
      setMessage(isReadyInsight(created) ? null : `Brief is ${created.status}.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : errorMessage);
    }
  };
  return { insight, message, generate };
}
