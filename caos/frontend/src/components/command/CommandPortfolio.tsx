"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CloseButton } from "@/components/shared/CloseButton";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { useRovingFocus } from "@/lib/useRovingFocus";
import { focusFirstRowAction, syncRowActionTabStops } from "@/lib/rowActionMode";
import type {
  CommandPortfolioPosition,
  CommandPosture,
} from "@/lib/portfolio-lab";

const POSTURE_ORDER: CommandPosture[] = [
  "OVERWEIGHT",
  "NEUTRAL",
  "UNDERWEIGHT",
  "UNKNOWN",
];

const POSTURE_COLOR: Record<CommandPosture, string> = {
  OVERWEIGHT: "var(--caos-success)",
  NEUTRAL: "var(--caos-muted)",
  UNDERWEIGHT: "var(--caos-critical)",
  UNKNOWN: "var(--caos-idle)",
};

const fmtMoney = (value: number | null) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value)
    : "—";

const fmtNumber = (value: number | null, suffix = "") =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}${suffix}`
    : "—";

export function CommandPortfolioPosture({
  counts,
  total,
  portfolioName,
}: {
  counts: Record<CommandPosture, number>;
  total: number;
  portfolioName: string;
}) {
  return (
    <section
      aria-label={`${portfolioName} portfolio posture`}
      className="shrink-0 rounded-md border border-caos-border bg-caos-panel px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="tabular text-caos-xs font-semibold uppercase tracking-wider text-caos-text">
          Portfolio posture · {total} positions
        </span>
        <div
          className="flex h-2.5 min-w-32 flex-1 overflow-hidden rounded border border-caos-border/60 bg-caos-bg"
          role="img"
          aria-label={POSTURE_ORDER.map((posture) => `${posture} ${counts[posture] ?? 0}`).join(", ")}
        >
          {POSTURE_ORDER.map((posture) => {
            const count = counts[posture] ?? 0;
            return count > 0 && total > 0 ? (
              <span
                key={posture}
                title={`${posture} · ${count}`}
                style={{ width: `${(count / total) * 100}%`, background: POSTURE_COLOR[posture] }}
              />
            ) : null;
          })}
        </div>
        <dl className="flex flex-wrap items-center gap-3">
          {POSTURE_ORDER.map((posture) => (
            <div key={posture} className="flex items-center gap-1.5">
              <dt className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
                {posture}
              </dt>
              <dd className="tabular text-caos-md font-semibold" style={{ color: POSTURE_COLOR[posture] }}>
                {counts[posture] ?? 0}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-1 text-caos-xs text-caos-muted">
        CP-3 posture uses only completed runs explicitly bound to this portfolio. Unlinked positions remain UNKNOWN.
      </p>
    </section>
  );
}

const COLS = "grid grid-cols-[72px_minmax(190px,1.35fr)_minmax(180px,1.2fr)_92px_64px_72px_90px_80px_110px_86px] gap-2 items-center";

export function CommandPortfolioTable({
  positions,
  selected,
  onSelect,
}: {
  positions: CommandPortfolioPosition[];
  selected: string | null;
  onSelect: (positionId: string) => void;
}) {
  const headers = ["Ticker", "Company", "Instrument", "Size", "Price", "Margin", "Maturity", "Ratings", "Posture", "QA"];
  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const rowIds = useMemo(() => positions.map((position) => position.id), [positions]);
  const { getItemProps: getRowFocusProps, setActiveId: setActiveRowId } = useRovingFocus(rowIds);

  useEffect(() => {
    if (selected && rowIds.includes(selected)) setActiveRowId(selected);
  }, [rowIds, selected, setActiveRowId]);

  useEffect(() => {
    if (actionRowId && !rowIds.includes(actionRowId)) setActionRowId(null);
    for (const [id, row] of rowRefs.current) syncRowActionTabStops(row, actionRowId === id);
  }, [actionRowId, rowIds]);

  return (
    <>
    <p id="command-portfolio-grid-help" className="sr-only">
      Use Up and Down Arrow to move between position rows. Press Enter or Space to open row details. Press F2 to enter row actions; press Escape to return to the row.
    </p>
    <div role="grid" aria-label="Persisted portfolio positions" aria-rowcount={positions.length + 1} className="h-full min-h-0 overflow-auto text-caos-md">
      <div className="min-w-[1120px]">
        <div role="row" aria-rowindex={1} className={`${COLS} sticky top-0 z-20 h-8 border-b border-caos-border bg-caos-panel px-3`}>
          {headers.map((header, index) => (
            <span
              key={header}
              role="columnheader"
              className={`tabular text-caos-xs font-semibold uppercase tracking-wider text-caos-text ${[3, 4, 5].includes(index) ? "text-right" : ""}`}
            >
              {header}
            </span>
          ))}
        </div>
        {positions.map((position, index) => {
          const isSelected = selected === position.id;
          const activate = () => onSelect(position.id);
          const focusProps = getRowFocusProps(position.id);
          const issuer = position.issuer_id ? { id: position.issuer_id } : null;
          const rating = [position.rating_moody, position.rating_sp].filter(Boolean).join(" / ") || "—";
          return (
            <div
              key={position.id}
              role="row"
              ref={(element) => {
                focusProps.ref(element);
                if (element) {
                  rowRefs.current.set(position.id, element);
                  syncRowActionTabStops(element, actionRowId === position.id);
                } else rowRefs.current.delete(position.id);
              }}
              tabIndex={actionRowId === position.id ? -1 : focusProps.tabIndex}
              onFocus={focusProps.onFocus}
              onBlur={(event) => {
                if (actionRowId === position.id && !event.currentTarget.contains(event.relatedTarget as Node | null)) setActionRowId(null);
              }}
              aria-selected={isSelected}
              aria-rowindex={index + 2}
              aria-keyshortcuts="F2"
              aria-describedby="command-portfolio-grid-help"
              aria-label={`${position.borrower_name} position details`}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("a, button, input, select, textarea, [role='button'], [role='link']")) return;
                activate();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && actionRowId === position.id) {
                  event.preventDefault();
                  setActionRowId(null);
                  event.currentTarget.focus();
                  return;
                }
                if (event.currentTarget !== event.target) return;
                if (event.key === "F2") {
                  if (focusFirstRowAction(event.currentTarget)) {
                    event.preventDefault();
                    setActionRowId(position.id);
                  }
                  return;
                }
                if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
                  setActionRowId(null);
                  focusProps.onKeyDown(event);
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activate();
                }
              }}
              className={`${COLS} cursor-pointer border-b border-caos-border/50 px-3 py-1.5 outline-none transition-caos focus-ring ${isSelected ? "bg-caos-accent/10" : "hover:bg-caos-elevated/50"}`}
            >
              <span role="gridcell" className="tabular text-caos-accent">
                {issuer ? <IssuerLink issuer={issuer}>{position.ticker || "—"}</IssuerLink> : position.ticker || "—"}
              </span>
              <span role="rowheader" className="min-w-0 break-words leading-snug text-caos-text">
                {issuer ? <IssuerLink issuer={issuer}>{position.borrower_name}</IssuerLink> : position.borrower_name}
              </span>
              <span role="gridcell" className="min-w-0 break-words leading-snug text-caos-text" title={position.loan_name || undefined}>
                {position.loan_name || position.ranking || "—"}
              </span>
              <span role="gridcell" className="tabular text-right text-caos-text">{fmtMoney(position.par_usd)}</span>
              <span role="gridcell" className="tabular text-right text-caos-text">{fmtNumber(position.price)}</span>
              <span role="gridcell" className="tabular text-right text-caos-text">{fmtNumber(position.margin_bps, "bp")}</span>
              <span role="gridcell" className="tabular text-caos-muted">{position.maturity || "—"}</span>
              <span role="gridcell" className="tabular text-caos-muted">{rating}</span>
              <span role="gridcell" className="tabular text-caos-xs font-medium" style={{ color: POSTURE_COLOR[position.posture] }}>
                {position.posture}
              </span>
              <span role="gridcell" className="tabular text-caos-xs text-caos-muted">{position.qa_status || "UNRATED"}</span>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}

export function CommandPositionStrip({
  position,
  onClose,
}: {
  position: CommandPortfolioPosition;
  onClose: () => void;
}) {
  const issuer = position.issuer_id ? { id: position.issuer_id } : null;
  const stat = (label: string, value: string) => (
    <span key={label} className="flex flex-col items-start">
      <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{label}</span>
      <span className="tabular text-caos-xl text-caos-text">{value}</span>
    </span>
  );
  return (
    <div className="caos-enter flex min-h-12 shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-t border-caos-border bg-caos-panel px-4 py-2">
      <span className="flex min-w-0 items-center gap-2">
        {issuer ? (
          <>
            <IssuerLink issuer={issuer} className="tabular text-caos-xl text-caos-accent">{position.ticker || "—"}</IssuerLink>
            <IssuerLink issuer={issuer} className="text-caos-xl font-medium text-caos-text">{position.borrower_name}</IssuerLink>
          </>
        ) : (
          <><span className="tabular text-caos-xl text-caos-muted">{position.ticker || "—"}</span><span className="text-caos-xl font-medium text-caos-text">{position.borrower_name}</span></>
        )}
      </span>
      {stat("Instrument", position.loan_name || position.ranking || "—")}
      {stat("Size", fmtMoney(position.par_usd))}
      {stat("Price", fmtNumber(position.price))}
      {stat("Margin", fmtNumber(position.margin_bps, "bp"))}
      {stat("Posture", position.posture)}
      <span className="flex-1" />
      {position.issuer_id ? (
        <Link href={`/deepdive?issuer=${encodeURIComponent(position.issuer_id)}${position.run_id ? `&run=${encodeURIComponent(position.run_id)}` : ""}`} className="caos-action-secondary no-underline focus-ring">
          Open Deep-Dive
        </Link>
      ) : <span className="text-caos-xs text-caos-muted">Issuer link unavailable</span>}
      <CloseButton onClick={onClose} title="Close (Esc)" />
    </div>
  );
}
