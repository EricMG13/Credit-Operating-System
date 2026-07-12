"use client";

import { useMemo } from "react";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { headStat } from "@/components/shared/headStat";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { PORTFOLIO } from "@/lib/command/data";
import { buildRVHoldingsMap, buildRVRows, RV_AS_OF, rvStaleness, RV_FILE_LABEL, RV_SECTORS } from "@/lib/command/rvdata";
import { SectorRV } from "@/components/command/SectorRV";
import { freshnessFrom } from "@/components/command/ActionableDislocations";
import { rankDislocations, canOpenDeepDive } from "@/lib/command/dislocations";
import { useSharedDayRun } from "@/lib/pipeline/sim";
import { usePortfolio } from "@/lib/engine/usePortfolio";
import { SimControls } from "@/components/pipeline/atoms";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
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
  const rvRows = useMemo(() => buildRVRows(holdings), [holdings]);
  const matchedHeld = useMemo(() => rvRows.filter((row) => row.portfolioRv.held).length, [rvRows]);
  // Same ranking ActionableDislocations opens with — the decision header must
  // never disagree with the panel it summarizes.
  const topDislocation = useMemo(() => rankDislocations(rvRows, 1)[0] ?? null, [rvRows]);
  const staleness = rvStaleness(RV_AS_OF);

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
      {/* Decision header — mirrors the SAME top-ranked dislocation
          ActionableDislocations opens with (rankDislocations), so this never
          disagrees with the panel below it. Evidence health carries the
          identical REFERENCE/DERIVED/freshness grammar as that panel's chip. */}
      <DecisionHeader
        whatChanged={
          topDislocation
            ? `${topDislocation.company} ${topDislocation.rvBp > 0 ? "+" : ""}${Math.round(topDislocation.rvBp)}bp vs sector×rating median`
            : undefined
        }
        whyItMatters={
          topDislocation
            ? `${topDislocation.rating} · ${topDislocation.subSector}${topDislocation.held ? " · held position" : ""}`
            : "No benchmarked loans in the current universe"
        }
        requiredAction={
          topDislocation
            ? topDislocation.held
              ? "Held position dislocated — review sizing"
              : canOpenDeepDive(topDislocation)
                ? `Open ${topDislocation.company} in Deep-Dive to assess`
                : "Unmatched name — no issuer profile to open"
            : undefined
        }
        evidenceHealth={{
          origin: "REFERENCE",
          method: "DERIVED",
          freshness: freshnessFrom(staleness.label),
          detail: "market-data.json reference feed · RV = 3Y DM − sector×rating median (n ≥ 2)",
          asOf: RV_AS_OF,
        }}
      />
      <div className="flex-1 overflow-y-auto gap-3.5 p-2 flex flex-col">
        <SectorRV holdings={holdings} />
      </div>
    </ResponsiveShell>
  );
}