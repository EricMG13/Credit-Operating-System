"use client";

// Document Intake — CP-0 source upload, in the CAOS design language shared by
// the concept sections: shared shell chrome, panel chrome, dense tabular controls.

import { Suspense } from "react";
import { UploadWizard } from "@/components/upload/UploadWizard";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ResponsiveShell } from "@/components/shared/ResponsiveShell";
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
      <ResponsiveShell
        identity={
          <ShellIdentity tag="CP-0 · L0" title="Document Intake — Pipeline L0 source readiness">
            <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap truncate hidden 2xl:inline">
              PDF / XLSX → document vault → parent-child chunking → CP-0 classification
            </span>
          </ShellIdentity>
        }
        contextualControls={<MnpiChip />}
        narrowContract={{ essentialControls: <MnpiChip /> }}
      >
        {/* wizard — the <main> landmark lives in the root layout */}
        <div className="flex-1 min-h-0 overflow-auto p-2">
          <Suspense fallback={null}>
            <UploadWizard />
          </Suspense>
        </div>
      </ResponsiveShell>
    </RequireAuth>
  );
}
