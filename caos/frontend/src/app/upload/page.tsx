"use client";

// Document Intake — CP-0 source upload, in the CAOS design language shared by
// the concept sections: h-10 sub-header, panel chrome, dense tabular controls.

import { Suspense } from "react";
import Link from "next/link";
import { UploadWizard } from "@/components/upload/UploadWizard";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ConceptNav } from "@/components/shared/ConceptNav";

export default function UploadPage() {
  return (
    <RequireAuth>
      <div className="h-screen flex flex-col bg-caos-bg">
        {/* Skip link + #main-content landmark live in the root layout — no page-local copy. */}
        {/* sub-header */}
        <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-3 px-4">
          <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap">
            ← Directory
          </Link>
          <div className="h-4 w-px bg-caos-border" />
          <ConceptNav compact />
          <div className="h-4 w-px bg-caos-border" />
          <span className="tabular text-caos-md text-caos-accent whitespace-nowrap">CP-0 · L0</span>
          <span className="text-caos-xl text-caos-text font-medium whitespace-nowrap">Document Intake — Pipeline L0 source readiness</span>
          <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap truncate">
            PDF / XLSX → document vault → parent-child chunking → CP-0 classification
          </span>
          <div className="flex-1" />
          <span
            className="tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap"
            style={{ color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 8%, transparent)" }}
          >
            MNPI uploads are restricted-handled
          </span>
        </div>

        {/* wizard — the <main> landmark now lives in the root layout */}
        <div className="flex-1 min-h-0 overflow-auto p-2">
          <Suspense fallback={null}>
            <UploadWizard />
          </Suspense>
        </div>
      </div>
    </RequireAuth>
  );
}
