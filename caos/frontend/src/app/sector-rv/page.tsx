"use client";

import { useMemo } from "react";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { headStat } from "@/components/shared/headStat";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { PORTFOLIO } from "@/lib/command/data";
import { buildRVHoldingsMap, buildRVRows, RV_FILE_LABEL, RV_SECTORS } from "@/lib/command/rvdata";
import { SectorRV } from "@/components/command/SectorRV";
import { useSimRun } from "@/lib/pipeline/sim";
import { usePortfolio } from "@/lib/engine/usePortfolio";
import { SIM_PLAN } from "@/lib/pipeline/data";
import { SimControls } from "@/components/pipeline/atoms";

export default function SectorRvPage() {
  return (
    <RequireAuth>
      <SectorRvWorkspace />
    </RequireAuth>
  );
}

function SectorRvWorkspace() {
  const run = useSimRun({ autoplay: true, plan: SIM_PLAN });
  const portfolio = usePortfolio();
  const holdings = useMemo(
    () => buildRVHoldingsMap(portfolio.live ? portfolio.rows : PORTFOLIO),
    [portfolio.live, portfolio.rows]
  );
  const rvLoanCount = RV_SECTORS.reduce((sum, sector) => sum + sector.rows.length, 0);
  const matchedHeld = useMemo(() => buildRVRows(holdings).filter((row) => row.portfolioRv.held).length, [holdings]);

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <div className="min-h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex flex-wrap items-center gap-x-5 gap-y-1 py-1 px-4">
        <ConceptNav compact />
        <div className="h-4 w-px bg-caos-border" />
        <span className="text-caos-md text-caos-muted truncate min-w-0">
          Loan universe
        </span>
        <span
          className="tabular text-caos-2xs uppercase tracking-wider whitespace-nowrap shrink-0 text-caos-warning"
          role="note"
          title="Sector RV uses the loaded market-data file with an exact-match portfolio overlay."
        >
          Market-data file + portfolio overlay
        </span>
        <div className="flex-1 min-w-0"></div>
        <div className="hidden lg:flex items-center gap-5 shrink-0">
          {headStat("Universe", "US HY Loan")}
          {headStat("Sectors", String(RV_SECTORS.length))}
          {headStat("Peer Loans", String(rvLoanCount))}
          {headStat("Held Matches", String(matchedHeld))}
        </div>
        <div className="h-4 w-px bg-caos-border hidden lg:block shrink-0" />
        {headStat("Source", "market-data", "var(--caos-accent)")}
        {headStat("File Date", RV_FILE_LABEL)}
        <div className="hidden min-[1780px]:flex items-center gap-5 shrink-0">
          <SimControls run={run} />
          <span className="tabular text-caos-md text-caos-muted whitespace-nowrap">{run.clock} ET</span>
        </div>
      </div>

      {/* workspace */}
      <div className="flex-1 overflow-y-auto gap-3.5 p-2 flex flex-col">
        <SectorRV holdings={holdings} />
      </div>
    </div>
  );
}
