import { RequireAuth } from "@/components/shared/RequireAuth";
import { SectorReviewDossier } from "@/components/sector/SectorReviewDossier";

export default function SectorReviewPage() {
  return (
    <RequireAuth>
      <SectorReviewDossier />
    </RequireAuth>
  );
}
