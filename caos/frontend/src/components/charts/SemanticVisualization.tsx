"use client";

import { useId, useMemo, useState } from "react";
import { G2Chart, type G2Spec } from "./G2Chart";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";

export type VisualizationKind =
  | "line"
  | "slope"
  | "scatter"
  | "bar"
  | "bullet"
  | "stacked-bar"
  | "heatmap"
  | "waterfall"
  | "maturity-wall"
  | "timeline"
  | "network";
export type VisualizationValue = string | number | boolean | null;
export type VisualizationDatum = Record<string, VisualizationValue>;

export interface VisualizationColumn {
  key: string;
  label: string;
}

export interface AccessibleDataTable<Datum extends VisualizationDatum = VisualizationDatum> {
  label: string;
  columns: readonly VisualizationColumn[];
  data: readonly Datum[];
}

export interface VisualizationSpec<Datum extends VisualizationDatum = VisualizationDatum> {
  kind: VisualizationKind;
  title: string;
  unit?: string;
  asOf?: string;
  sourceIds: readonly string[];
  accessibleSummary: string;
  note?: string;
  status?: { label: string; tone: "success" | "warning" | "critical" | "idle" };
  data: unknown[];
  tabularFallback: AccessibleDataTable<Datum>;
  chart: Omit<G2Spec, "data">;
}

function cellText(value: VisualizationValue) {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

// A raw GUID as a source id reads as noise; show a short, titled id. Non-uuid
// ids (e.g. "rv-screen") pass through unchanged.
function sourceLabel(id: string): { text: string; title?: string } {
  return /^[0-9a-f-]{20,}$/i.test(id) ? { text: `ID ${id.slice(0, 8)}…`, title: id } : { text: id };
}

// Count/interval charts over a tiny integer domain get fractional y-ticks and
// rotated x-labels from G2's autoscaling. Derive an honest axis: integer-only
// y-labels, horizontal x-labels, and real titles from the accessible table's
// column labels. An explicit spec.chart.axis/scale still wins (merged under).
function deriveAxis<Datum extends VisualizationDatum>(spec: VisualizationSpec<Datum>): Record<string, unknown> {
  const enc = (spec.chart as { type?: string; encode?: { x?: string; y?: string } });
  const yKey = enc.encode?.y;
  const xKey = enc.encode?.x;
  const isCount = !!yKey
    && ["interval", "bar", "stacked-bar"].includes(enc.type ?? "")
    && spec.data.every((d) => Number.isInteger((d as Record<string, unknown>)[yKey] as number));
  if (!isCount) return {};
  const label = (key?: string) => spec.tabularFallback.columns.find((c) => c.key === key)?.label;
  return {
    axis: {
      x: { title: label(xKey) ?? false, labelAutoRotate: false },
      y: { title: label(yKey) ?? false, labelFormatter: (v: unknown) => (Number.isInteger(Number(v)) ? String(v) : "") },
    },
    scale: { y: { domainMin: 0, nice: false } },
  };
}

export function SemanticVisualization<Datum extends VisualizationDatum>({
  spec,
  height = 220,
  mode = "dark",
}: {
  spec: VisualizationSpec<Datum>;
  height?: number;
  mode?: "dark" | "paper";
}) {
  const [showTable, setShowTable] = useState(false);
  const summaryId = useId();
  const tableId = useId();
  const chartSpec = useMemo(
    () => ({ ...deriveAxis(spec), ...spec.chart, data: spec.data }),
    [spec],
  );

  return (
    <figure className="semantic-visualization" data-kind={spec.kind} data-mode={mode}>
      <figcaption className="semantic-visualization__header">
        <div>
          <h3>{spec.title}</h3>
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
      <div
        role="img"
        aria-label={spec.title}
        aria-describedby={summaryId}
        className="semantic-visualization__chart"
      >
        <G2Chart spec={chartSpec} height={height} mode={mode} />
      </div>
      {spec.note ? <p className="semantic-visualization__note">{spec.note}</p> : null}
      <div className="semantic-visualization__sources" aria-label="Visualization sources">
        <span>Sources</span>
        <ul>{spec.sourceIds.map((sourceId) => { const s = sourceLabel(sourceId); return <li key={sourceId} title={s.title} className="tabular">{s.text}</li>; })}</ul>
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
          <thead>
            <tr>{spec.tabularFallback.columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {spec.tabularFallback.data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {spec.tabularFallback.columns.map((column) => <td key={column.key}>{cellText(row[column.key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </DominantTableRegion>
    </figure>
  );
}
