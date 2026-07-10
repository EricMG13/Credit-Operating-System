import { RequireAuth } from "@/components/shared/RequireAuth";
import { SectorReviewWorkspace } from "@/components/sector/SectorReviewWorkspace";

export default function SectorReviewPage() {
  return (
    <RequireAuth>
      <SectorReviewWorkspace />
    </RequireAuth>
  );
}
