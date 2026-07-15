import type { AnalysisContext } from "@/lib/analysis-workbench";

export async function ensureIssuerScope(
  context: AnalysisContext | null,
  issuerId: string,
  patch: (changes: Partial<AnalysisContext>) => Promise<AnalysisContext | null>,
): Promise<AnalysisContext | null> {
  if (!context || context.issuer_ids.includes(issuerId)) return context;
  const scoped = await patch({ issuer_ids: [...context.issuer_ids, issuerId] });
  if (!scoped) throw new Error("Analysis context could not be scoped to the issuer.");
  return scoped;
}
