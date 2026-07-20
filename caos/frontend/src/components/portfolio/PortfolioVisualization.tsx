"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import type {
  VisualizationDatum,
  VisualizationSpec,
  VisualizationValue,
} from "@/components/charts/SemanticVisualization";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function cellText(value: VisualizationValue | undefined) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function sourceLabel(id: string): { text: string; title?: string } {
  return /^[0-9a-f-]{20,}$/i.test(id)
    ? { text: `ID ${id.slice(0, 8)}…`, title: id }
    : { text: id };
}

function finiteNumber(value: VisualizationValue | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function visualKeys<Datum extends VisualizationDatum>(spec: VisualizationSpec<Datum>) {
  const chart = spec.chart as { encode?: { x?: string; y?: string; color?: string } };
  const labelKey = chart.encode?.x ?? spec.tabularFallback.columns[0]?.key;
  const candidates = [chart.encode?.y, chart.encode?.color, ...spec.tabularFallback.columns.map((column) => column.key)]
    .filter((key): key is string => Boolean(key && key !== labelKey));
  const valueKey = candidates.find((key) => spec.tabularFallback.data.some((row) => finiteNumber(row[key]) !== null));
  const statusKey = candidates.find((key) => key !== valueKey && spec.tabularFallback.data.some((row) => typeof row[key] === "string"));
  return { labelKey, valueKey, statusKey };
}

function valueText(value: number | null, unit?: string) {
  if (value === null) return "—";
  if (unit === "USD") return compactUsd.format(value);
  if (unit?.includes("%")) return `${value.toLocaleString()}%`;
  return value.toLocaleString();
}

function toneForRow(kind: VisualizationSpec["kind"], value: number | null, status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("breach") || normalized.includes("fail") || (kind === "bullet" && value !== null && value < 0)) return "critical";
  if (normalized.includes("watch") || normalized.includes("partial") || normalized.includes("stale")) return "warning";
  if (normalized.includes("pass") || normalized.includes("ready") || normalized.includes("complete")) return "success";
  if (kind === "heatmap" && value !== null && value > 0) return "critical";
  return "accent";
}

function PortfolioChart<Datum extends VisualizationDatum>({ spec }: { spec: VisualizationSpec<Datum> }) {
  const { labelKey, valueKey, statusKey } = useMemo(() => visualKeys(spec), [spec]);
  const rows = spec.tabularFallback.data.map((row) => ({
    row,
    label: cellText(labelKey ? row[labelKey] : undefined),
    value: finiteNumber(valueKey ? row[valueKey] : undefined),
    status: statusKey ? cellText(row[statusKey]) : "",
  }));
  const values = rows.flatMap((row) => row.value === null ? [] : [row.value]);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const span = Math.max(1, maximum - minimum);
  const zero = (-minimum / span) * 100;

  if (!rows.length) return <p className="portfolio-visualization__empty">No values to plot.</p>;

  return (
    <div className="portfolio-visualization__plot" style={{ "--portfolio-zero": `${zero}%` } as CSSProperties}>
      {rows.map(({ label, value, status }, index) => {
        const numericValue = value ?? 0;
        const start = numericValue < 0 ? ((numericValue - minimum) / span) * 100 : zero;
        const width = value === null ? 0 : (Math.abs(numericValue) / span) * 100;
        return (
          <div className="portfolio-visualization__row" key={`${label}-${index}`} data-tone={toneForRow(spec.kind, value, status)}>
            <span className="portfolio-visualization__label" title={label}>{label}</span>
            <span className="portfolio-visualization__track" aria-hidden="true">
              <span className="portfolio-visualization__zero" />
              <span className="portfolio-visualization__bar" style={{ left: `${start}%`, width: `${width}%` }} />
            </span>
            <span className="portfolio-visualization__value tabular">{valueText(value, spec.unit)}</span>
            {status ? <span className="portfolio-visualization__row-status">{status}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

export function PortfolioVisualization<Datum extends VisualizationDatum>({
  spec,
  headingLevel = 3,
}: {
  spec: VisualizationSpec<Datum>;
  headingLevel?: 2 | 3;
}) {
  const [showTable, setShowTable] = useState(false);
  const summaryId = useId();
  const tableId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <figure className="semantic-visualization portfolio-visualization" data-kind={spec.kind} data-mode="dark">
      <figcaption className="semantic-visualization__header">
        <div>
          <Heading>{spec.title}</Heading>
          <div className="semantic-visualization__meta">
            {spec.unit ? <span>Unit {spec.unit}</span> : null}
            {spec.asOf ? <span>As of {spec.asOf}</span> : null}
          </div>
        </div>
        {spec.status ? (
          <span className="semantic-visualization__status" data-tone={spec.status.tone}>
            <span aria-hidden="true">●</span> {spec.status.label}
          </span>
        ) : null}
      </figcaption>
      <p id={summaryId} className="semantic-visualization__summary">{spec.accessibleSummary}</p>
      <div role="img" aria-label={spec.title} aria-describedby={summaryId} className="semantic-visualization__chart">
        <PortfolioChart spec={spec} />
      </div>
      {spec.note ? <p className="semantic-visualization__note">{spec.note}</p> : null}
      <div className="semantic-visualization__sources" aria-label="Visualization sources">
        <span>Sources</span>
        <ul>{spec.sourceIds.map((sourceId) => { const source = sourceLabel(sourceId); return <li key={sourceId} title={source.title} className="tabular">{source.text}</li>; })}</ul>
      </div>
      <button
        type="button"
        aria-expanded={showTable}
        aria-controls={tableId}
        onClick={() => setShowTable((visible) => !visible)}
        className="semantic-visualization__table-toggle"
      >
        {showTable ? "Hide equivalent table" : "Show equivalent table"}
      </button>
      <DominantTableRegion
        id={tableId}
        ownerId={`${summaryId}-fallback`}
        label={`${spec.title} equivalent data`}
        exemption="accessible-fallback"
        aria-hidden={!showTable}
        data-visible={showTable ? "true" : "false"}
        className="semantic-visualization__table-region"
      >
        <table aria-label={spec.tabularFallback.label}>
          <thead><tr>{spec.tabularFallback.columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
          <tbody>{spec.tabularFallback.data.map((row, rowIndex) => (
            <tr key={rowIndex}>{spec.tabularFallback.columns.map((column) => <td key={column.key}>{cellText(row[column.key])}</td>)}</tr>
          ))}</tbody>
        </table>
      </DominantTableRegion>
    </figure>
  );
}
