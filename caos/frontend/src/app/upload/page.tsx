"use client";

// Document Intake — CP-0 source upload, in the CAOS design language shared by
// the concept sections: shared shell chrome, panel chrome, dense tabular controls.

import { Suspense } from "react";
import { UploadWizard } from "@/components/upload/UploadWizard";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { ShellIdentity } from "@/components/shared/ShellIdentity";

// The MNPI handling notice must survive every breakpoint — it is a policy
// marker, not a convenience control.
function MnpiChip() {
  return (
    <span
      className="tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap"
      style={{
        color: "var(--caos-warning)",
        borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)",
        background: "color-mix(in srgb, var(--caos-warning) 8%, transparent)",
      }}
    >
      MNPI uploads are restricted-handled
    </span>
  );
}

export default function UploadPage() {
  return (
    <RequireAuth>
      <EnterprisePage kind="wizard"
        identity={
          <ShellIdentity tag="CP-0 · L0" title="Document Intake — Pipeline L0 source readiness">
            <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap truncate hidden 2xl:inline">
              PDF / XLSX → document vault → parent-child chunking → CP-0 classification
            </span>
          </ShellIdentity>
        }
        primaryAction={<a href="#intake-workspace" className="caos-primary-action focus-ring no-underline" title="Jump to the intake wizard — the real ingest is its 'Upload & process' button">Open intake</a>}
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
