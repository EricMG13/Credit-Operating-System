import type { ModuleOutput, OutSection } from "@/lib/deepdive/module-outputs";
import { fm, fx, type Report, type ReportSource, type Section, type TableRow } from "./builders";

interface LiveReportInput {
  issuerId: string;
  runId: string;
  asOf?: string | null;
  committeeStatus?: string | null;
  liveOuts: Record<string, ModuleOutput>;
  liveStatus: Record<string, string>;
}

interface PersistedVersionLike {
  id: string;
  run_id: string;
  status?: string;
  payload: Record<string, unknown>;
  created_at: string;
}

const MAX_FROZEN_OVERRIDE_ROWS = 500;

function modelAmount(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? fm(value) : "";
}

function modelMultiple(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? fx(value) : "";
}

function auditCell(value: unknown, missing = "Unavailable"): string | number {
  if (value === null) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) return value;
  return missing;
}

function frozenOverrideStatus(expiresAt: unknown, reportEventAt?: string): string {
  if (expiresAt === null || expiresAt === undefined || expiresAt === "") {
    return "ACTIVE AT REPORT EVENT";
  }
  if (typeof expiresAt !== "string" || !reportEventAt) return "STATUS UNKNOWN";
  const expiry = Date.parse(expiresAt);
  const eventAt = Date.parse(reportEventAt);
  if (!Number.isFinite(expiry) || !Number.isFinite(eventAt)) return "STATUS UNKNOWN";
  return expiry > eventAt ? "ACTIVE AT REPORT EVENT" : "INACTIVE AT REPORT EVENT";
}

function normalizedReportingText(value: unknown, uppercase = false): string {
  if (typeof value !== "string" || !value.trim()) return "Unavailable";
  const text = value.trim();
  return uppercase ? text.toUpperCase() : text;
}

function frozenInstrumentCurrencies(values: unknown[]): Map<string, string> {
  const currencies = new Map<string, string>();
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const instrument = value as Record<string, unknown>;
    if (typeof instrument.instrument_id !== "string" || !instrument.instrument_id) continue;
    currencies.set(instrument.instrument_id, normalizedReportingText(instrument.currency, true));
  }
  return currencies;
}

function frozenModelReportingIdentity(snapshot: Record<string, unknown>) {
  const payload = snapshot.payload && typeof snapshot.payload === "object"
    ? snapshot.payload as Record<string, unknown>
    : {};
  const currency = normalizedReportingText(payload.reporting_currency, true);
  const unit = normalizedReportingText(payload.reporting_unit);
  const debtInstruments = Array.isArray(payload.debt_instruments) ? payload.debt_instruments : [];
  const overrides = Array.isArray(payload.overrides) ? payload.overrides : [];
  return { currency, unit, scale: `${currency} ${unit}`, instrumentCurrencies: frozenInstrumentCurrencies(debtInstruments), overrides };
}

type FrozenReporting = ReturnType<typeof frozenModelReportingIdentity>;

function frozenIdentitySection(snapshot: Record<string, unknown>, calculation: Record<string, unknown>, reporting: FrozenReporting): Section {
  const authority = snapshot.authority as Record<string, unknown> | undefined;
  const origins = Array.isArray(authority?.model_input_origins) ? (authority.model_input_origins as unknown[]).join(", ") : "unknown";
  return {
    t: "profile",
    title: "MODEL ENGINE V2 · FROZEN IDENTITY",
    rows: [
      ["Engine version", String(snapshot.engine_version ?? "Unavailable")],
      ["Source fingerprint", String(snapshot.source_fingerprint ?? "Unavailable")],
      ["Input fingerprint", String(snapshot.input_fingerprint ?? "Unavailable")],
      ["Calculation hash", String(snapshot.calculation_hash ?? "Unavailable")],
      ["Draft revision", String(snapshot.draft_revision ?? "Unavailable")],
      ["Reporting currency", reporting.currency],
      ["Reporting unit", reporting.unit],
      ["Availability", String(calculation.status ?? "unknown").toUpperCase()],
      ["Model origin", String(authority?.origin ?? "unknown").toUpperCase()],
      ["Model input origins", origins],
      ["Model analyst override", authority?.analyst_override ? "YES" : "NO"],
    ],
  };
}

function availabilityLedger(calculation: Record<string, unknown>): Section | null {
  const gaps = Array.isArray(calculation.gaps) ? calculation.gaps : [];
  const warnings = Array.isArray(calculation.warnings) ? calculation.warnings : [];
  if (!gaps.length && !warnings.length) return null;
  return {
    t: "table",
    title: "MODEL ENGINE V2 · AVAILABILITY LEDGER",
    cols: ["Type", "Detail"],
    align: [0, 0],
    rows: [
      ...gaps.map((value) => ({ cells: ["GAP", String(value)] })),
      ...warnings.map((value) => ({ cells: ["WARNING", String(value)] })),
    ],
  };
}

function frozenModelRow(period: Record<string, unknown>): TableRow {
  return { cells: [
    String(period.period_key ?? ""), String(period.label ?? ""),
    modelAmount(period.revenue), modelAmount(period.adjusted_ebitda),
    modelAmount(period.cash_interest), modelAmount(period.total_debt),
    modelAmount(period.net_debt), modelMultiple(period.gross_leverage),
    modelMultiple(period.net_leverage), modelMultiple(period.interest_coverage),
    modelAmount(period.free_cash_flow),
  ] };
}

function frozenDebtRow(periodKey: string, instrument: Record<string, unknown>, reporting: FrozenReporting): TableRow {
  const instrumentId = String(instrument.instrument_id ?? "");
  return { cells: [
    periodKey, instrumentId, reporting.instrumentCurrencies.get(instrumentId) ?? "Unavailable",
    modelAmount(instrument.opening_balance), modelAmount(instrument.closing_balance),
    modelAmount(instrument.average_balance), modelAmount(instrument.benchmark_interest),
    modelAmount(instrument.margin_interest), modelAmount(instrument.coupon_interest),
    modelAmount(instrument.fees), modelAmount(instrument.pik_interest),
    modelAmount(instrument.hedge_effect), modelAmount(instrument.fx_effect),
    modelAmount(instrument.cash_interest), modelAmount(instrument.debt_reporting_currency),
    modelAmount(instrument.rollforward_residual),
  ] };
}

function collectPeriodNodes(period: Record<string, unknown>, nodes: Map<string, Record<string, unknown>>) {
  for (const value of Array.isArray(period.nodes) ? period.nodes : []) {
    if (!value || typeof value !== "object") continue;
    const node = value as Record<string, unknown>;
    if (typeof node.node_id === "string") nodes.set(node.node_id, node);
  }
}

function collectPeriodDebtRows(period: Record<string, unknown>, reporting: FrozenReporting, debtRows: TableRow[]) {
  const periodKey = String(period.period_key ?? "");
  for (const value of Array.isArray(period.instruments) ? period.instruments : []) {
    if (value && typeof value === "object") debtRows.push(frozenDebtRow(periodKey, value as Record<string, unknown>, reporting));
  }
}

function collectFrozenPeriodRows(periods: unknown[], reporting: FrozenReporting) {
  const modelRows: TableRow[] = [];
  const debtRows: TableRow[] = [];
  const nodes = new Map<string, Record<string, unknown>>();
  for (const value of periods) {
    if (!value || typeof value !== "object") continue;
    const period = value as Record<string, unknown>;
    modelRows.push(frozenModelRow(period));
    collectPeriodNodes(period, nodes);
    collectPeriodDebtRows(period, reporting, debtRows);
  }
  return { debtRows, modelRows, nodes };
}

function frozenOverrideRow(override: Record<string, unknown>, nodes: Map<string, Record<string, unknown>>, reportEventAt?: string): TableRow {
  const nodeId = String(override.node_id ?? "Unavailable");
  const displaced = nodes.get(nodeId);
  const formula = typeof displaced?.formula === "string" && displaced.formula.trim() ? displaced.formula : "No formula (input)";
  return { cells: [
    frozenOverrideStatus(override.expires_at, reportEventAt), nodeId,
    override.value_type === "null" ? "NULL" : auditCell(override.value),
    auditCell(override.reason), auditCell(override.scope), auditCell(override.source),
    auditCell(override.expires_at, "No expiry"), formula, auditCell(displaced?.original_value),
  ] };
}

function frozenOverrideSection(reporting: FrozenReporting, nodes: Map<string, Record<string, unknown>>, reportEventAt?: string): Section | null {
  const overrides = reporting.overrides
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
    .sort((left, right) => String(left.node_id ?? "").localeCompare(String(right.node_id ?? "")));
  const renderedOverrides = overrides.slice(0, MAX_FROZEN_OVERRIDE_ROWS);
  if (!renderedOverrides.length) return null;
  const rows = renderedOverrides.map((override) => frozenOverrideRow(override, nodes, reportEventAt));
  const omitted = overrides.length - renderedOverrides.length;
  if (omitted) rows.push({ cells: ["TRUNCATED", `${omitted} additional overrides remain in the frozen payload`, "", "", "", "", "", "", ""] });
  return {
    t: "table",
    title: "MODEL ENGINE V2 · FROZEN OVERRIDE LEDGER",
    cols: ["Status", "Node", "Value", "Reason", "Scope", "Source", "Expires", "Displaced formula", "Displaced value"],
    align: [0, 0, 1, 0, 0, 0, 0, 0, 1],
    rows,
  };
}

function frozenCalculationSection(rows: TableRow[], reporting: FrozenReporting): Section | null {
  if (!rows.length) return null;
  return {
    t: "table",
    title: `MODEL ENGINE V2 · CALCULATION · ${reporting.scale.toUpperCase()}`,
    cols: ["Period", "Label", "Revenue", "Adj. EBITDA", "Cash interest", "Total debt", "Net debt", "Gross lev.", "Net lev.", "Interest coverage", "FCF"],
    align: [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    rows,
  };
}

function frozenDebtSection(rows: TableRow[], reporting: FrozenReporting): Section | null {
  if (!rows.length) return null;
  return {
    t: "table",
    title: `MODEL ENGINE V2 · DEBT SCHEDULE · ${reporting.unit.toUpperCase()} · REPORTING CURRENCY ${reporting.currency}`,
    cols: ["Period", "Instrument", "Currency", "Opening", "Closing", "Average", "Benchmark", "Margin", "Coupon", "Fees", "PIK", "Hedge", "FX", "Cash interest", `Debt (${reporting.scale})`, "Roll-forward residual"],
    align: [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    rows,
  };
}

function frozenModelSections(payload: Record<string, unknown>, reportEventAt?: string): Section[] {
  const model = payload.model;
  if (!model || typeof model !== "object") return [];
  const snapshot = model as Record<string, unknown>;
  const calculation = snapshot.calculation;
  if (!calculation || typeof calculation !== "object") return [];
  const calculationRecord = calculation as Record<string, unknown>;
  const periods = Array.isArray(calculationRecord.periods) ? calculationRecord.periods : [];
  const reporting = frozenModelReportingIdentity(snapshot);
  const collected = collectFrozenPeriodRows(periods, reporting);
  return [
    frozenIdentitySection(snapshot, calculationRecord, reporting),
    availabilityLedger(calculationRecord),
    frozenOverrideSection(reporting, collected.nodes, reportEventAt),
    frozenCalculationSection(collected.modelRows, reporting),
    frozenDebtSection(collected.debtRows, reporting),
  ].filter((section): section is Section => section !== null);
}

function sourceIds(section: OutSection): string[] {
  if (section.type === "text") return section.ev ?? [];
  if (section.type === "flags") return section.items.flatMap((item) => item.ev ?? []);
  return [];
}

function reportSection(section: OutSection): Section {
  if (section.type === "table") {
    return {
      t: "table",
      title: section.title,
      cols: section.cols,
      align: section.align ?? section.cols.map((_, index) => index === 0 ? 0 : 1),
      rows: section.rows.map((cells) => ({ cells })),
    };
  }
  if (section.type === "text") return { t: "text", title: section.title, body: section.body };
  return {
    t: "table",
    title: section.title,
    cols: ["Status", "Finding", "Evidence"],
    align: [0, 0, 0],
    rows: section.items.map((item) => ({ cells: [item.sev.toUpperCase(), item.text, (item.ev ?? []).join(", ")] })),
  };
}

export function buildLiveReports(input: LiveReportInput): Report[] {
  const moduleIds = Object.keys(input.liveOuts).sort();
  if (!input.runId || !moduleIds.length) return [];
  const sections: Section[] = [{
    t: "profile",
    title: "FROZEN ANALYSIS ENVELOPE",
    rows: [
      ["Issuer", input.issuerId],
      ["Run", input.runId],
      ["As of", input.asOf ?? "Unavailable"],
      ["Committee status", input.committeeStatus ?? "Unavailable"],
      ["Modules included", String(moduleIds.length)],
    ],
  }];
  const sources: ReportSource[] = [];
  for (const moduleId of moduleIds) {
    const output = input.liveOuts[moduleId];
    const evidence = Array.from(new Set(output.sections.flatMap(sourceIds)));
    sources.push({ chip: moduleId, ev: evidence });
    const kpiRows: TableRow[] = output.kpis.map((kpi) => ({ cells: [kpi.l, kpi.v, kpi.sev?.toUpperCase() ?? ""] }));
    if (kpiRows.length) {
      sections.push({
        t: "table",
        title: `${moduleId} · HEADLINE OUTPUTS`,
        sub: `QA ${input.liveStatus[moduleId] ?? "Not Reviewed"}`,
        cols: ["Measure", "Value", "Signal"],
        align: [0, 1, 0],
        rows: kpiRows,
      });
    }
    sections.push(...output.sections.map(reportSection));
  }
  return [{
    id: `live-committee-pack:${input.runId}`,
    title: "Live IC Credit Memo",
    file: `${input.issuerId}-IC-Credit-Memo`,
    subtitle: `${input.issuerId} · run ${input.runId} · ${input.asOf ?? "as-of unavailable"}`,
    icon: "document",
    srcs: sources,
    sections,
  }];
}

function fallbackSections(document: Record<string, unknown>): Section[] {
  const modules = Array.isArray(document.sections) ? document.sections : [];
  const sections: Section[] = [{
    t: "profile",
    title: "IMMUTABLE VERSION ENVELOPE",
    rows: [
      ["Issuer", String(document.issuer_id ?? "Unavailable")],
      ["Run", String(document.run_id ?? "Unavailable")],
      ["As of", String(document.as_of_date ?? "Unavailable")],
      ["Committee status", String(document.committee_status ?? "Unavailable")],
    ],
  }];
  for (const item of modules) {
    if (!item || typeof item !== "object") continue;
    const moduleRow = item as Record<string, unknown>;
    sections.push({
      t: "text",
      title: `${String(moduleRow.module_id ?? "MODULE")} · ${String(moduleRow.module_name ?? "Frozen output")}`,
      body: JSON.stringify(moduleRow.summary ?? {}, null, 2),
    });
  }
  return sections;
}

export function reportFromVersion(version: PersistedVersionLike): Report {
  const modelSections = frozenModelSections(version.payload, version.created_at);
  const composition = version.payload.composition;
  if (composition && typeof composition === "object") {
    const record = composition as Record<string, unknown>;
    const rendered = record.reviewed_report ?? record.rendered_report;
    if (rendered && typeof rendered === "object" && Array.isArray((rendered as Report).sections)) {
      return {
        ...(rendered as Report),
        id: version.id,
        title: `${(rendered as Report).title} · ${version.status === "preview" ? "frozen preview" : "published"}`,
        sections: [...(rendered as Report).sections, ...modelSections],
      };
    }
  }
  const document = version.payload.document && typeof version.payload.document === "object"
    ? version.payload.document as Record<string, unknown>
    : {};
  return {
    id: version.id,
    title: "Published IC Credit Memo",
    file: `${String(document.issuer_id ?? "issuer")}-${version.id}`,
    subtitle: `Immutable version ${version.id} · ${version.created_at}`,
    icon: "document",
    srcs: [],
    sections: [...fallbackSections(document), ...modelSections],
  };
}
