import { ICBookWorkbench } from "@/components/decisions/ICBookWorkbench";
import { RequireAuth } from "@/components/shared/RequireAuth";

export default function DecisionsPage() {
  return <RequireAuth><ICBookWorkbench /></RequireAuth>;
}
