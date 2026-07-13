"use client";

import { useId, useMemo, useState } from "react";
import { G2Chart, type G2Spec } from "./G2Chart";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";

export type VisualizationKind =
  | "line"
  | "slope"
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
  const chartSpec = useMemo(
    () => ({ ...spec.chart, data: spec.data }),
    [spec.chart, spec.data],
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
      <div className="semantic-visualization__sources" aria-label="Visualization sources">
        <span>Sources</span>
        <ul>{spec.sourceIds.map((sourceId) => <li key={sourceId}>{sourceId}</li>)}</ul>
      </div>
      <button
        type="button"
        aria-expanded={showTable}
        onClick={() => setShowTable((visible) => !visible)}
        className="semantic-visualization__table-toggle"
      >
        {showTable ? "Hide equivalent table" : "Show equivalent table"}
      </button>
      {showTable ? (
        <DominantTableRegion
          ownerId={`${summaryId}-fallback`}
          label={`${spec.title} equivalent data`}
          exemption="accessible-fallback"
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
      ) : null}
    </figure>
  );
}
