import { describe, it, expect } from "vitest";
import { draftToAlertRows, formatImpact } from "./inbox";
import type { AutonomyDraft } from "@/lib/api";

function draft(overrides: Partial<AutonomyDraft> = {}): AutonomyDraft {
  return {
    status: "draft",
    ai_generated: true,
    ratified: false,
    export_allowed: false,
    marking: "AI-GENERATED, UNRATIFIED",
    generated_at: "2026-07-12T09:00:00Z",
    sections: [],
    summary: { n_sections: 0, n_claims: 0, n_deterministic_bullets: 0, n_anomalies: 0 },
    refreshing: false,
    ...overrides,
  };
}

describe("draftToAlertRows", () => {
  it("empty draft → empty rows (honest empty, not an error)", () => {
    expect(draftToAlertRows(draft())).toEqual([]);
  });

  it("claims map to MODELLED rows, bullets to DERIVED rows, both ranked by severity desc", () => {
    const d = draft({
      sections: [
        {
          issuer_id: "ATLF",
          issuer_name: "Atlas Forge",
          max_severity: 0.9,
          claims: [
            {
              text: "EBITDA margin compressed sharply vs peers",
              claim_type: "anomaly",
              anomaly_kind: "peer-outlier",
              anomaly_severity: 0.9,
              chunk_ids: ["c1"],
              fact_ids: ["f1"],
              model: "claude-opus-4-8",
            },
          ],
          deterministic_bullets: [
            { kind: "ts-jump", severity: 0.4, metric: "net_leverage", direction: "up", chunk_id: "c2", context: {} },
          ],
          exhibit: [],
        },
      ],
    });
    const rows = draftToAlertRows(d);
    expect(rows).toHaveLength(2);
    expect(rows[0].method).toBe("MODELLED");
    expect(rows[0].severity).toBe(0.9);
    expect(rows[1].method).toBe("DERIVED");
    expect(rows[1].severity).toBe(0.4);
  });

  it("a keyless deploy (deterministic-bullets-only draft) still produces rows with no claims", () => {
    const d = draft({
      sections: [
        {
          issuer_id: "QLMH",
          issuer_name: "Quill Media",
          max_severity: 0.6,
          claims: [],
          deterministic_bullets: [
            { kind: "cusum-shift", severity: 0.6, metric: "revenue", direction: "down", chunk_id: null, context: {} },
          ],
          exhibit: [],
        },
      ],
    });
    const rows = draftToAlertRows(d);
    expect(rows).toHaveLength(1);
    expect(rows[0].method).toBe("DERIVED");
    expect(rows[0].evidence.chunkIds).toEqual([]);
  });

  it("alert_key is stable across two reads of the SAME cycle (same generated_at)", () => {
    const section: AutonomyDraft["sections"][number] = {
      issuer_id: "EG",
      issuer_name: "EG Group",
      max_severity: 0.5,
      claims: [],
      deterministic_bullets: [{ kind: "ts-jump", severity: 0.5, metric: "dm", direction: "up", chunk_id: null, context: {} }],
      exhibit: [],
    };
    const a = draftToAlertRows(draft({ sections: [section] }));
    const b = draftToAlertRows(draft({ sections: [section] }));
    expect(a[0].key).toBe(b[0].key);
  });

  it("a later cycle (different generated_at) produces a DIFFERENT key for the same anomaly — resets to open", () => {
    const section: AutonomyDraft["sections"][number] = {
      issuer_id: "EG",
      issuer_name: "EG Group",
      max_severity: 0.5,
      claims: [],
      deterministic_bullets: [{ kind: "ts-jump", severity: 0.5, metric: "dm", direction: "up", chunk_id: null, context: {} }],
      exhibit: [],
    };
    const a = draftToAlertRows(draft({ sections: [section], generated_at: "2026-07-12T09:00:00Z" }));
    const b = draftToAlertRows(draft({ sections: [section], generated_at: "2026-07-12T10:00:00Z" }));
    expect(a[0].key).not.toBe(b[0].key);
  });

  it("the empty-draft envelope (error set, no sections) still resolves to []", () => {
    const d = draft({ sections: [], error: "autonomy cycle unavailable" });
    expect(draftToAlertRows(d)).toEqual([]);
  });
});

describe("formatImpact", () => {
  it("renders the severity as a standard-deviations figure", () => {
    expect(formatImpact({ severity: 2.34 })).toBe("2.3σ");
    expect(formatImpact({ severity: 0.7 })).toBe("0.7σ");
  });

  it("renders null (never a fabricated 0) for a non-finite severity", () => {
    expect(formatImpact({ severity: NaN })).toBeNull();
    expect(formatImpact({ severity: Infinity })).toBeNull();
    expect(formatImpact({ severity: -Infinity })).toBeNull();
  });
});
