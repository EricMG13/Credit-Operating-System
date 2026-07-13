import { PortfolioLabWorkbench } from "@/components/portfolio/PortfolioLabWorkbench";
import { RequireAuth } from "@/components/shared/RequireAuth";

export default function PortfolioLabPage() {
  return (
    <RequireAuth>
      <PortfolioLabWorkbench />
    </RequireAuth>
  );
}
