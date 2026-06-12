"use client";

// Document Intake — CP-0 source upload, in the CAOS design language shared by
// the concept sections: h-10 sub-header, panel chrome, dense tabular controls.

import Link from "next/link";
import { UploadWizard } from "@/components/upload/UploadWizard";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ConceptNav } from "@/components/shared/ConceptNav";

export default function UploadPage() {
  return (
    <RequireAuth>
      <div className="h-screen flex flex-col bg-caos-bg">
        {/* sub-header */}
        <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-3 px-4">
          <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-[11px] transition-caos whitespace-nowrap">
            ← Directory
          </Link>
          <div className="h-4 w-px bg-caos-border" />
          <ConceptNav compact />
          <div className="h-4 w-px bg-caos-border" />
          <span className="tabular text-[10px] text-caos-accent whitespace-nowrap">CP-0</span>
          <span className="text-[11px] text-caos-text font-medium whitespace-nowrap">Document Intake — source readiness</span>
          <span className="tabular text-[9.5px] text-caos-muted whitespace-nowrap truncate">
            PDF / XLSX → document vault → parent-child chunking → CP-0 classification
          </span>
          <div className="flex-1" />
          <span
            className="tabular text-[9px] uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap"
            style={{ color: "var(--caos-warning)", borderColor: "rgba(245,165,36,0.4)", background: "rgba(245,165,36,0.08)" }}
          >
            MNPI uploads are restricted-handled
          </span>
        </div>

        {/* wizard */}
        <div className="flex-1 min-h-0 overflow-auto p-2">
          <UploadWizard />
        </div>
      </div>
    </RequireAuth>
  );
}
