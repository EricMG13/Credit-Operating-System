// Format a metric value for display by its catalog unit ($M / % / x).

export function fmtMetric(value: number, unit: string): string {
  if (unit === "$M") return "$" + Math.round(value).toLocaleString() + "M";
  if (unit === "%") return value.toFixed(1) + "%";
  if (unit === "x") return value.toFixed(2) + "x";
  return String(value);
}
