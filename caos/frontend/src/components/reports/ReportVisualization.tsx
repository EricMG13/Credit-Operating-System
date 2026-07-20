"use client";

import type { Section } from "@/lib/reports/builders";

type ReportChartSection = Extract<Section, { t: "chart" }>;
type ChartDatum = Record<string, string | number | boolean | null>;

const SERIES_COLORS = [
  "var(--tranche-1l)",
  "var(--tranche-2l)",
  "var(--tranche-unsec)",
  "var(--tranche-sub)",
  "var(--tranche-equity)",
] as const;

function chartRows(section: ReportChartSection): ChartDatum[] {
  return Array.isArray(section.spec.data) ? section.spec.data as ChartDatum[] : [];
}

function encodings(section: ReportChartSection) {
  const encode = section.spec.encode as { x?: string; y?: string; color?: string } | undefined;
  return { x: encode?.x ?? section.columns[0]?.key, y: encode?.y ?? section.columns[1]?.key, color: encode?.color };
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function categories(rows: ChartDatum[], key: string | undefined): string[] {
  if (!key) return [];
  return Array.from(new Set(rows.map((row) => String(row[key] ?? "—"))));
}

function LightweightBars({ section, rows, height }: { section: ReportChartSection; rows: ChartDatum[]; height: number }) {
  const encode = encodings(section);
  const xValues = categories(rows, encode.x);
  const seriesValues = categories(rows, encode.color);
  const max = Math.max(1, ...rows.map((row) => numeric(encode.y ? row[encode.y] : null)));
  const plotHeight = Math.max(72, height - 34);
  const groupWidth = xValues.length ? 580 / xValues.length : 580;
  const barWidth = Math.max(5, Math.min(28, (groupWidth - 12) / Math.max(1, seriesValues.length || 1)));
  return (
    <svg viewBox={`0 0 640 ${height}`} width="100%" height={height} aria-hidden="true" focusable="false">
      <line x1="40" y1={plotHeight} x2="620" y2={plotHeight} stroke="var(--paper-rule)" strokeWidth="1" />
      {rows.map((row, index) => {
        const xIndex = Math.max(0, xValues.indexOf(String(encode.x ? row[encode.x] ?? "—" : "—")));
        const seriesIndex = encode.color ? Math.max(0, seriesValues.indexOf(String(row[encode.color] ?? "—"))) : 0;
        const value = numeric(encode.y ? row[encode.y] : null);
        const renderedHeight = Math.max(1, value / max * (plotHeight - 18));
        const groupStart = 40 + xIndex * groupWidth;
        const x = groupStart + (groupWidth - barWidth * Math.max(1, seriesValues.length || 1)) / 2 + seriesIndex * barWidth;
        return <rect key={index} x={x} y={plotHeight - renderedHeight} width={Math.max(3, barWidth - 2)} height={renderedHeight} fill={SERIES_COLORS[seriesIndex % SERIES_COLORS.length]} />;
      })}
      {xValues.map((label, index) => <text key={label} x={40 + index * groupWidth + groupWidth / 2} y={height - 8} textAnchor="middle" fill="var(--paper-meta)" fontSize="10">{label}</text>)}
    </svg>
  );
}

function LightweightLine({ section, rows, height }: { section: ReportChartSection; rows: ChartDatum[]; height: number }) {
  const encode = encodings(section);
  const values = rows.map((row) => numeric(encode.y ? row[encode.y] : null));
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = Math.max(1, max - min);
  const points = rows.map((row, index) => {
    const x = rows.length <= 1 ? 320 : 40 + index * (580 / (rows.length - 1));
    const y = 18 + (max - numeric(encode.y ? row[encode.y] : null)) / span * (height - 46);
    return { x, y, label: String(encode.x ? row[encode.x] ?? "—" : "—") };
  });
  return (
    <svg viewBox={`0 0 640 ${height}`} width="100%" height={height} aria-hidden="true" focusable="false">
      <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="var(--paper-ink)" strokeWidth="2" />
      {points.map((point) => <g key={`${point.x}-${point.label}`}><circle cx={point.x} cy={point.y} r="3" fill="var(--paper-ink)" /><text x={point.x} y={height - 8} textAnchor="middle" fill="var(--paper-meta)" fontSize="10">{point.label}</text></g>)}
    </svg>
  );
}

function LightweightStack({ section, rows, height }: { section: ReportChartSection; rows: ChartDatum[]; height: number }) {
  const encode = encodings(section);
  const total = Math.max(1, rows.reduce((sum, row) => sum + numeric(encode.y ? row[encode.y] : null), 0));
  let offset = 0;
  return (
    <svg viewBox={`0 0 640 ${height}`} width="100%" height={height} aria-hidden="true" focusable="false">
      {rows.map((row, index) => {
        const value = numeric(encode.y ? row[encode.y] : null);
        const width = value / total * 620;
        const x = 10 + offset;
        offset += width;
        const label = String(encode.color ? row[encode.color] ?? "—" : row[section.columns[0]?.key] ?? "—");
        return <g key={index}><rect x={x} y="8" width={width} height={Math.max(28, height - 16)} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />{width >= 86 ? <text x={x + width / 2} y={height / 2 + 4} textAnchor="middle" fill="var(--paper-bg)" fontSize="10" fontWeight="700">{label} · {value.toLocaleString()}</text> : null}</g>;
      })}
    </svg>
  );
}

function ReportChartInk({ section, rows, height }: { section: ReportChartSection; rows: ChartDatum[]; height: number }) {
  if (section.kind === "stacked-bar") return <LightweightStack section={section} rows={rows} height={height} />;
  if (section.kind === "line" || section.kind === "slope") return <LightweightLine section={section} rows={rows} height={height} />;
  return <LightweightBars section={section} rows={rows} height={height} />;
}

function cellText(value: ChartDatum[string]) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function ReportVisualization({ section, height }: { section: ReportChartSection; height: number }) {
  const rows = chartRows(section);
  return (
    <figure className="semantic-visualization report-visualization" data-kind={section.kind} data-mode="paper" data-testid="report-visualization" data-height={height}>
      <figcaption className="semantic-visualization__header">
        <div><h3>{section.title}</h3><div className="semantic-visualization__meta">{section.unit ? <span>Unit {section.unit}</span> : null}</div></div>
      </figcaption>
      <p className="semantic-visualization__summary">{section.accessibleSummary}</p>
      <div role="img" aria-label={section.title} className="semantic-visualization__chart"><ReportChartInk section={section} rows={rows} height={height} /></div>
      <div className="semantic-visualization__sources" aria-label="Visualization sources"><span>Sources</span><ul>{section.sourceIds.map((source) => <li key={source} className="tabular">{source}</li>)}</ul></div>
      <details className="report-visualization__table">
        <summary>Show equivalent table</summary>
        <table aria-label={`${section.title} data`}>
          <thead><tr>{section.columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
          <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{section.columns.map((column) => <td key={column.key}>{cellText(row[column.key])}</td>)}</tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
