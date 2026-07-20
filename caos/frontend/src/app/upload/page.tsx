"use client";

// Document Intake — CP-0 source upload, in the CAOS design language shared by
// the concept sections: shared shell chrome, panel chrome, dense tabular controls.

import { Suspense, useId } from "react";
import { UploadWizard } from "@/components/upload/UploadWizard";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { ShellIdentity } from "@/components/shared/ShellIdentity";

// The MNPI handling notice must survive every breakpoint — it is a policy
// marker, not a convenience control.
function MnpiChip() {
  const limitationsId = useId();
  return (
    <details className="relative">
      <summary
        aria-describedby={limitationsId}
        className="focus-ring cursor-pointer list-none tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap"
        style={{
          color: "var(--caos-warning)",
          borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)",
          background: "color-mix(in srgb, var(--caos-warning) 8%, transparent)",
        }}
      >
        MNPI handling policy applies · analyst-declared classification
      </summary>
      <p id={limitationsId} className="absolute right-0 z-popover mt-1 w-80 max-w-[calc(100vw-2rem)] rounded border border-caos-border bg-caos-panel p-2 text-caos-xs normal-case leading-relaxed tracking-normal text-caos-text shadow-lg">
        Classification is declared by the analyst; CAOS does not detect MNPI and does not itself enforce need-to-know entitlements. Handling remains subject to workspace access and governance.
      </p>
    </details>
  );
}

export default function UploadPage() {
  return (
    <RequireAuth>
      <EnterprisePage kind="wizard"
        identity={
          <ShellIdentity tag="CP-0 · L0" title="Document Intake — Pipeline L0 source readiness">
            <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap truncate hidden 2xl:inline">
              PDF / XLSX → document vault → searchable evidence → source classification
            </span>
          </ShellIdentity>
        }
        contextualControls={<MnpiChip />}
        narrowContract={{ essentialControls: <MnpiChip /> }}
      >
        {/* wizard — the <main> landmark lives in the root layout */}
        <div id="intake-workspace" className="caos-persona-route upload-workbench flex-1 min-h-0 overflow-auto p-2" tabIndex={-1}>
          <PersonaWorkbench surface="upload" primary={
          <Suspense fallback={null}>
            <UploadWizard />
          </Suspense>
          } />
        </div>
      </EnterprisePage>
    </RequireAuth>
  );
}
