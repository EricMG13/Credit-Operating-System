"use client";

import { QueryInvestigationWorkbench } from "@/components/query/QueryInvestigationWorkbench";
import { RequireAuth } from "@/components/shared/RequireAuth";

export default function QueryPage() {
  return (
    <RequireAuth>
      <QueryInvestigationWorkbench />
    </RequireAuth>
  );
}
