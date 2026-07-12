// Reports' original caveatKind-based authority block API — kept intact for
// zero churn on ReportDoc/reports/page.tsx and the AuthorityBlock.test.tsx
// contract. The actual rendering now lives in the shared, surface-agnostic
// component (components/shared/AuthorityBlock.tsx) so Research's tear-sheet
// can render the same structured Origin/Method/Freshness block without
// forking the caveatKind vocabulary that only makes sense for Report Studio.

import type { DeepDiveCaveatKind } from "@/lib/deepdive/caveat";
import { fromReportCaveat } from "@/lib/provenance";
import { AuthorityBlock as SharedAuthorityBlock } from "@/components/shared/AuthorityBlock";

const UNKNOWN_TEXT: Record<"loading" | "error" | "noRun", string> = {
  loading: "ORIGIN: UNKNOWN — checking for a live issuer run",
  error: "ORIGIN: UNKNOWN — could not confirm live-run status",
  noRun: "ORIGIN: UNKNOWN — no completed run for this issuer",
};

export function AuthorityBlock({
  caveatKind,
  liveRunBacked,
  runId,
  qaNote,
}: {
  caveatKind: DeepDiveCaveatKind;
  liveRunBacked: boolean;
  runId?: string | null;
  qaNote?: string | null;
}) {
  const prov = fromReportCaveat(caveatKind, liveRunBacked);
  const unknownText = prov
    ? undefined
    : UNKNOWN_TEXT[caveatKind as "loading" | "error" | "noRun"];

  return <SharedAuthorityBlock prov={prov} unknownText={unknownText} runId={runId} qaNote={qaNote} />;
}
