"use client";

import Link from "next/link";
import { ResponsiveShell, type NarrowContract } from "./ResponsiveShell";
import { AnalysisContextStrip } from "./AnalysisContextStrip";
import { Button } from "@/components/ui/Button";

export type { NarrowContract } from "./ResponsiveShell";

export type EnterpriseSurfaceKind = "overview" | "worklist" | "object" | "analytical" | "editor" | "wizard";

export type PageAction = {
  label: string;
  title?: string;
  unavailableReason?: string | null;
} & (
  | { href: string; onAction?: never }
  | { onAction: () => void; href?: never }
);

function EnterprisePrimaryAction({ action }: { action?: PageAction }) {
  if (!action) return null;
  if (action.unavailableReason) {
    return (
      <Button
        variant="primary"
        reason={action.unavailableReason}
        reasonDisplay="hidden"
        title={action.title}
      >
        {action.label}
      </Button>
    );
  }
  if (action.href !== undefined) {
    return (
      <Link href={action.href} title={action.title} className="caos-action-primary no-underline focus-ring">
        {action.label}
      </Link>
    );
  }
  return (
    <Button variant="primary" onClick={action.onAction} title={action.title}>
      {action.label}
    </Button>
  );
}

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
  primaryAction?: PageAction;
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
      primaryAction={primaryAction ? <EnterprisePrimaryAction action={primaryAction} /> : undefined}
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
