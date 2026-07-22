import { afterEach, describe, expect, it } from "vitest";
import {
  api,
  createWatchRule,
  getChunk,
  getAlertEventPage,
  getWatchRulePage,
  updateWatchRule,
  type AlertEventDTO,
  type WatchRuleDTO,
  type WatchRuleWriteDTO,
} from "./api";

const originalAdapter = api.defaults.adapter;

const EVENT: AlertEventDTO = {
  id: "event-1",
  alert_key: "c3:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  issuer_id: "issuer-1",
  run_id: "run-1",
  kind: "qa_change",
  title: "QA gate changed",
  impact: "Review governed evidence.",
  evidence: { observed_at: "2026-07-20T10:00:00Z" },
  authority: { watch_rule_id: "rule-1", rule_version: 3 },
  state: "open",
  assignee: null,
  note: null,
  resolved_at: null,
  resolution_note: null,
  created_at: "2026-07-20T10:01:00Z",
  updated_at: "2026-07-20T10:01:00Z",
};

const RULE: WatchRuleDTO = {
  id: "rule-1",
  name: "QA gate watch",
  signal_type: "qa_gate",
  enabled: true,
  paused: false,
  issuer_id: "issuer-1",
  portfolio_id: null,
  can_mutate: true,
  current_version: 3,
  schedule_kind: "event_driven",
  schedule_interval_seconds: null,
  next_evaluation_at: null,
  last_evaluated_at: null,
  config: { operator: "present", threshold: null, kind: "qa_change", title: "QA changed", impact: "Review." },
  created_at: "2026-07-20T09:00:00Z",
  updated_at: "2026-07-20T10:00:00Z",
};

const WRITE: WatchRuleWriteDTO = {
  name: RULE.name,
  signal_type: RULE.signal_type,
  enabled: RULE.enabled,
  paused: RULE.paused,
  issuer_id: RULE.issuer_id,
  portfolio_id: RULE.portfolio_id,
  schedule_kind: RULE.schedule_kind,
  schedule_interval_seconds: RULE.schedule_interval_seconds,
  next_evaluation_at: RULE.next_evaluation_at,
  config: RULE.config,
};

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

describe("persisted Monitor API wrappers", () => {
  it("preserves scoped page parameters, abort signals, and signed next cursors", async () => {
    const requests: Array<Record<string, unknown>> = [];
    api.defaults.adapter = ((config: Record<string, unknown>) => {
      requests.push(config);
      const eventRequest = config.url === "/api/alerts/events";
      return Promise.resolve({
        data: eventRequest ? [EVENT] : [RULE],
        status: 200,
        statusText: "OK",
        headers: {
          "x-next-cursor": eventRequest ? "signed-event-cursor" : "signed-rule-cursor",
          ...(eventRequest
            ? { "x-alert-event-can-mutate": "true" }
            : { "x-watch-rule-can-create": "true" }),
        },
        config,
      });
    }) as never;
    const eventAbort = new AbortController();
    const ruleAbort = new AbortController();

    await expect(getAlertEventPage({
      state: "open",
      issuerId: "issuer-1",
      kind: "qa_change",
      limit: 25,
      cursor: "event-cursor",
      signal: eventAbort.signal,
    })).resolves.toEqual({ items: [EVENT], nextCursor: "signed-event-cursor", canMutate: true });
    await expect(getWatchRulePage({ limit: 40, cursor: "rule-cursor", signal: ruleAbort.signal }))
      .resolves.toEqual({ items: [RULE], nextCursor: "signed-rule-cursor", canCreate: true });

    expect(requests[0]).toMatchObject({
      url: "/api/alerts/events",
      method: "get",
      params: { state: "open", issuer_id: "issuer-1", kind: "qa_change", limit: 25, cursor: "event-cursor" },
      signal: eventAbort.signal,
    });
    expect(requests[1]).toMatchObject({
      url: "/api/watch-rules",
      method: "get",
      params: { limit: 40, cursor: "rule-cursor" },
      signal: ruleAbort.signal,
    });
  });

  it("sends only the caller-owned rule body and the expected version envelope", async () => {
    const requests: Array<Record<string, unknown>> = [];
    api.defaults.adapter = ((config: Record<string, unknown>) => {
      requests.push(config);
      return Promise.resolve({ data: RULE, status: 200, statusText: "OK", headers: {}, config });
    }) as never;

    await createWatchRule(WRITE, "watch-rule-create-op-1");
    await updateWatchRule("rule/1", 3, WRITE);
    const createBody = JSON.parse(String(requests[0]?.data));
    const updateBody = JSON.parse(String(requests[1]?.data));

    expect(createBody).toEqual(WRITE);
    expect((requests[0]?.headers as Record<string, unknown>)["Idempotency-Key"]).toBe("watch-rule-create-op-1");
    expect(updateBody).toEqual({ expected_version: 3, patch: WRITE });
    expect(requests[1]?.url).toBe("/api/watch-rules/rule%2F1");
    for (const body of [createBody, updateBody.patch]) {
      expect(body).not.toHaveProperty("owner_user_id");
      expect(body).not.toHaveProperty("team_id_snapshot");
      expect(body).not.toHaveProperty("tenant_id");
      expect(body).not.toHaveProperty("current_version");
      expect(body).not.toHaveProperty("destination_ref");
      expect(body).not.toHaveProperty("delivery_state");
    }
  });

  it("encodes persisted chunk ids as one path segment", async () => {
    const requests: Array<Record<string, unknown>> = [];
    api.defaults.adapter = ((config: Record<string, unknown>) => {
      requests.push(config);
      return Promise.resolve({ data: { id: "chunk", doc: "Evidence", text: "Persisted." }, status: 200, statusText: "OK", headers: {}, config });
    }) as never;

    await getChunk("../../settings");

    expect(requests[0]?.url).toBe("/api/query/chunk/..%2F..%2Fsettings");
  });
});
