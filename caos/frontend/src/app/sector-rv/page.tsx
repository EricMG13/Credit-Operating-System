"use client";

import { useMemo } from "react";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { headStat } from "@/components/shared/headStat";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { PORTFOLIO } from "@/lib/command/data";
import { buildRVHoldingsMap, buildRVRows, RV_FILE_LABEL, RV_SECTORS } from "@/lib/command/rvdata";
import { SectorRV } from "@/components/command/SectorRV";
import { useSharedDayRun } from "@/lib/pipeline/sim";
import { usePortfolio } from "@/lib/engine/usePortfolio";
import { SimControls } from "@/components/pipeline/atoms";
import { ResponsiveShell, type NarrowContract } from "@/components/shared/ResponsiveShell";

export default function SectorRvPage() {
  return (
    <RequireAuth>
      <SectorRvWorkspace />
    </RequireAuth>
  );
}

function SectorRvWorkspace() {
  const run = useSharedDayRun();
  const portfolio = usePortfolio();
  const holdings = useMemo(
    () => buildRVHoldingsMap(portfolio.live ? portfolio.rows : PORTFOLIO),
    [portfolio.live, portfolio.rows]
  );
  const rvLoanCount = RV_SECTORS.reduce((sum, sector) => sum + sector.rows.length, 0);
  const matchedHeld = useMemo(() => buildRVRows(holdings).filter((row) => row.portfolioRv.held).length, [holdings]);

  const narrowContract: NarrowContract = {
    // At <1280px, the header shows only the 4 summary metrics + sim clock.
    // The full set (including SimControls) renders at ≥1280px.
    essentialControls: (
      <div className="flex items-center gap-4 shrink-0 overflow-x-auto caos-no-scrollbar">
        {headStat("Universe", "US HY Loan")}
        {headStat("Sectors", String(RV_SECTORS.length))}
        {headStat("Peer Loans", String(rvLoanCount))}
        {headStat("Held Matches", String(matchedHeld))}
      </div>
    ),
  };

  return (
    <ResponsiveShell
      identity={
        <>
          <ConceptNav compact />
          <span className="h-4 w-px bg-caos-border shrink-0" />
          <span className="text-caos-md text-caos-muted truncate min-w-0">Loan universe</span>
          {portfolio.error ? (
            // M-6 honesty: a failed portfolio fetch is NOT the same as "sample
            // overlay by design" — say the overlay is degraded, not just generic.
            <span
              className="tabular text-caos-2xs uppercase tracking-wider whitespace-nowrap shrink-0 hidden lg:inline"
              style={{ color: "var(--caos-warning)" }}
              role="note"
              title="The portfolio fetch failed — overlay shows the static sample sleeve, not current holdings."
            >
              market-data + sample overlay (portfolio unavailable)
            </span>
          ) : (
            <span
              className="tabular text-caos-2xs uppercase tracking-wider whitespace-nowrap shrink-0 text-caos-muted hidden lg:inline"
              title="Sector RV uses the loaded market-data file with an exact-match portfolio overlay."
            >
              market-data + portfolio overlay
            </span>
          )}
        </>
      }
      contextualControls={
        <>
          {headStat("Universe", "US HY Loan")}
          {headStat("Sectors", String(RV_SECTORS.length))}
          {headStat("Peer Loans", String(rvLoanCount))}
          {headStat("Held Matches", String(matchedHeld))}
          {headStat("Source", "market-data", "var(--caos-accent)")}
          {headStat("File Date", RV_FILE_LABEL)}
          <SimControls run={run} />
          <span className="tabular text-caos-md text-caos-muted whitespace-nowrap">{run.clock} ET</span>
        </>
      }
      narrowContract={narrowContract}
    >
      <div className="flex-1 overflow-y-auto gap-3.5 p-2 flex flex-col">
        <SectorRV holdings={holdings} />
      </div>
    </ResponsiveShell>
  );
}