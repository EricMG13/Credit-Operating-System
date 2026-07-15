"use client";

import { RVScreenerWorkbench } from "@/components/rv/RVScreenerWorkbench";
import { RequireAuth } from "@/components/shared/RequireAuth";

export default function SectorRvPage() {
  return (
    <RequireAuth>
      <RVScreenerWorkbench />
    </RequireAuth>
  );
}
