"use client";

// One-way "Export to vault" action: writes the run's hub + spoke Markdown notes
// into the configured Obsidian vault. Self-contained, inline button — state lives
// in the label (with detail on hover) so it fits a dense toolbar or a rail. Drop
// it wherever a live runId exists. Status is stamped into the note frontmatter
// server-side, so this is not gated on Committee Ready.

import { useState } from "react";
import { AxiosError } from "axios";

import { exportToVault } from "@/lib/api";

type State =
  | { kind: "idle" | "busy" }
  | { kind: "done"; files: string[] }
  | { kind: "error"; msg: string };

const BASE =
  "tabular text-caos-sm whitespace-nowrap px-2.5 py-1 rounded border transition-caos aria-disabled:opacity-50";

const vaultExportError = (status?: number): string => status === 503
  ? "Vault export not configured (VAULT_EXPORT_DIR unset)."
  : "Export failed — try again.";

const vaultPresentation = (state: State): { label: string; tone: string; title: string } => {
  switch (state.kind) {
    case "busy":
      return {
        label: "EXPORTING…",
        tone: "border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg",
        title: "Write this run to the Obsidian vault (hub + spoke notes)",
      };
    case "done":
      return {
        label: `✓ EXPORTED · ${state.files.length} note${state.files.length === 1 ? "" : "s"}`,
        tone: "border-caos-success text-caos-success",
        title: `Wrote: ${state.files.join(" · ")}`,
      };
    case "error":
      return {
        label: "✗ EXPORT FAILED",
        tone: "border-caos-critical text-caos-critical-bright hover:bg-caos-critical hover:text-caos-bg",
        title: state.msg,
      };
    default:
      return {
        label: "⬓ EXPORT TO VAULT",
        tone: "border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg",
        title: "Write this run to the Obsidian vault (hub + spoke notes)",
      };
  }
};

export function ExportToVaultButton({ runId, className = "" }: { runId: string; className?: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onClick() {
    if (state.kind === "busy") return;
    setState({ kind: "busy" });
    try {
      const { written } = await exportToVault(runId);
      setState({ kind: "done", files: written });
    } catch (e) {
      const status = (e as AxiosError)?.response?.status;
      setState({ kind: "error", msg: vaultExportError(status) });
    }
  }

  const { label, tone, title } = vaultPresentation(state);

  return (
    <button
      onClick={onClick}
      aria-disabled={state.kind === "busy" || undefined}
      title={title}
      className={`${BASE} ${tone} ${className}`}
    >
      {label}
    </button>
  );
}
