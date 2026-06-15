"use client";

// Concept H — Loan Scorecard: the documentation-protection score for a single
// deal (Covenant-Review-style Composite + 5 sub-scores + 6 quality scores, 1 =
// most protective → 5 = deficient). Pick a deal; the server scores its terms via
// the deterministic methodology. When no covenant-review document is attached the
// score falls back to the empirical signals CAOS derives, flagged in the view.
// Data is /api/scorecard/{deal_id}. See docs/SCORECARD_SCHEMA.md.

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { Panel } from "@/components/shared/Panel";
import { getDeals, getScorecard } from "@/lib/api";
import type { DealSummary } from "@/lib/compare/types";
import type { Scorecard } from "@/lib/scorecard/types";
import { ScorecardView } from "@/components/scorecard/Scorecard";

export default function ScorecardPage() {
  return (
    <RequireAuth>
      <ScorecardWorkspace />
    </RequireAuth>
  );
}

function ScorecardWorkspace() {
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [dealId, setDealId] = useState<string>("");
  const [card, setCard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the pickable deals; default to the first so the scorecard renders on open.
  useEffect(() => {
    getDeals()
      .then((ds) => {
        setDeals(ds);
        setDealId((prev) => prev || (ds[0]?.id ?? ""));
      })
      .catch(() => setError("Could not load deals."))
      .finally(() => setLoading(false));
  }, []);

  // Fetch the scorecard whenever the selected deal changes.
  useEffect(() => {
    if (!dealId) {
      setCard(null);
      return;
    }
    let cancelled = false;
    setCard(null);
    getScorecard(dealId)
      .then((sc) => !cancelled && setCard(sc))
      .catch(() => !cancelled && setError("Could not load the scorecard."));
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-5 px-4">
        <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-[11px] transition-caos whitespace-nowrap">
          ← Directory
        </Link>
        <div className="h-4 w-px bg-caos-border" />
        <ConceptNav compact />
        <div className="h-4 w-px bg-caos-border" />
        <span className="text-[11px] text-caos-text font-medium whitespace-nowrap">
          Loan Scorecard — documentation-protection score
        </span>
        <div className="flex-1" />
        <label className="flex items-center gap-2 whitespace-nowrap">
          <span className="tabular text-caos-micro uppercase tracking-wider text-caos-muted">Deal</span>
          <select
            value={dealId}
            onChange={(e) => setDealId(e.target.value)}
            className="tabular text-[11px] bg-caos-elevated text-caos-text border border-caos-border rounded px-2 py-1 max-w-[280px] focus:border-caos-accent outline-none"
          >
            {deals.length === 0 ? <option value="">No deals</option> : null}
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
                {d.issuer_name ? ` · ${d.issuer_name}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* workspace */}
      <div className="flex-1 min-h-0 p-2">
        <Panel title="Documentation-protection scorecard" className="h-full">
          {loading ? (
            <div className="h-full flex items-center justify-center text-caos-muted text-caos-body">Loading deals…</div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-caos-critical text-caos-body">{error}</div>
          ) : !dealId ? (
            <div className="h-full flex items-center justify-center text-caos-muted text-caos-body px-6 text-center">
              No deals available to score yet — onboard a deal in the intake flow.
            </div>
          ) : !card ? (
            <div className="h-full flex items-center justify-center text-caos-muted text-caos-body">Scoring…</div>
          ) : (
            <ScorecardView card={card} />
          )}
        </Panel>
      </div>
    </div>
  );
}
