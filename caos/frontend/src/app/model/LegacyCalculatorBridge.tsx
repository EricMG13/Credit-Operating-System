"use client";

import type { ReactNode } from "react";
import { buildModel } from "@/lib/reports/model";
import { buildReports } from "@/lib/reports/builders";

export type LegacyBuildModel = typeof buildModel;
export interface LegacyModelRuntime {
  buildModel: LegacyBuildModel;
  buildReports: typeof buildReports;
}

/**
 * Lazy boundary for the TypeScript reference calculator.
 *
 * The parent renders this module only after workspace settings explicitly
 * confirm the legacy capability. Model Engine v2 and fail-closed routes never
 * download or evaluate the calculator module.
 */
export default function LegacyCalculatorBridge({
  children,
}: {
  children: (runtime: LegacyModelRuntime) => ReactNode;
}) {
  return children({ buildModel, buildReports });
}
