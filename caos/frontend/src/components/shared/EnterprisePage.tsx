"use client";

import { ResponsiveShell, type NarrowContract } from "./ResponsiveShell";
import { AnalysisContextStrip } from "./AnalysisContextStrip";

export type { NarrowContract } from "./ResponsiveShell";

export type EnterpriseSurfaceKind = "overview" | "worklist" | "object" | "analytical" | "editor" | "wizard";

/**
 * Shared enterprise page anatomy. It standardizes chrome and decision/finalize
 * placement while deliberately leaving body layout and overflow ownership to
 * each surface kind (Model/Query/Reports remain specialist editors).
 */
export function EnterprisePage({
  kind,
  identity,
  status,
  primaryAction,
  contextualControls,
  utilityControls,
  utilityLabel,
  decisionContext,
  finalizationBar,
  narrowContract,
  children,
  className = "",
  heightClass = "h-screen",
}: {
  kind: EnterpriseSurfaceKind;
  identity: React.ReactNode;
  status?: React.ReactNode;
  primaryAction?: React.ReactNode;
  contextualControls?: React.ReactNode;
  utilityControls?: React.ReactNode;
  utilityLabel?: string;
  decisionContext?: React.ReactNode;
  finalizationBar?: React.ReactNode;
  narrowContract: NarrowContract;
  children: React.ReactNode;
  className?: string;
  heightClass?: string;
}) {
  return (
    <ResponsiveShell
      identity={identity}
      status={status}
      primaryAction={primaryAction}
      contextualControls={contextualControls}
      utilityControls={utilityControls}
      utilityLabel={utilityLabel}
      narrowContract={narrowContract}
      className={`caos-enterprise-page caos-surface-${kind} ${className}`}
      heightClass={heightClass}
    >
      <AnalysisContextStrip />
      {decisionContext}
      {children}
      {finalizationBar ? (
        <footer className="caos-finalization-bar" aria-label="Page finalization actions">
          {finalizationBar}
        </footer>
      ) : null}
    </ResponsiveShell>
  );
}
