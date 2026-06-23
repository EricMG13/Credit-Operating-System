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
  "tabular text-caos-sm whitespace-nowrap px-2.5 py-1 rounded border transition-caos disabled:opacity-50";

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
      setState({
        kind: "error",
        msg: status === 503 ? "Vault export not configured (VAULT_EXPORT_DIR unset)." : "Export failed — try again.",
      });
    }
  }

  const label =
    state.kind === "busy" ? "EXPORTING…"
    : state.kind === "done" ? `✓ EXPORTED · ${state.files.length} note${state.files.length === 1 ? "" : "s"}`
    : state.kind === "error" ? "✗ EXPORT FAILED"
    : "⬓ EXPORT TO VAULT";

  const tone =
    state.kind === "error" ? "border-caos-critical text-caos-critical-bright hover:bg-caos-critical hover:text-caos-bg"
    : state.kind === "done" ? "border-caos-success text-caos-success"
    : "border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg";

  return (
    <button
      onClick={onClick}
      disabled={state.kind === "busy"}
      title={
        state.kind === "done" ? `Wrote: ${state.files.join(" · ")}`
        : state.kind === "error" ? state.msg
        : "Write this run to the Obsidian vault (hub + spoke notes)"
      }
      className={`${BASE} ${tone} ${className}`}
    >
      {label}
    </button>
  );
}
