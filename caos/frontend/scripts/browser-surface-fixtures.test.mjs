import assert from 'node:assert/strict';
import test from 'node:test';
import { installSurfaceStubs } from './browser-surface-fixtures.mjs';

function fixtureTarget() {
  const handlers = new Map();
  return {
    handlers,
    async route(pattern, handler) {
      handlers.set(pattern, handler);
    },
  };
}

async function dispatch(handler, method, path, body) {
  let response = null;
  let fellThrough = false;
  const route = {
    request: () => ({
      method: () => method,
      url: () => `http://fixture.local${path}`,
      postDataJSON: () => body,
    }),
    fulfill: async (result) => { response = result; },
    fallback: async () => { fellThrough = true; },
  };
  await handler(route);
  assert.equal(fellThrough, false, `${method} ${path} fell through to the developer API`);
  assert.ok(response, `${method} ${path} did not return a fixture response`);
  return { ...response, json: response.body ? JSON.parse(response.body) : null };
}

test('alert-event and watch-rule prefixes own every method without leaking mutable state', async () => {
  const first = fixtureTarget();
  await installSurfaceStubs(first, { id: 'fixture-user' });
  const alerts = first.handlers.get('**/api/alerts/events**');
  const rules = first.handlers.get('**/api/watch-rules**');
  assert.equal(typeof alerts, 'function');
  assert.equal(typeof rules, 'function');

  const patchedAlert = await dispatch(alerts, 'PATCH', '/api/alerts/events/alert-event-1', {
    state: 'ack',
    assignee: 'fixture.analyst',
  });
  assert.equal(patchedAlert.status, 200);
  assert.equal(patchedAlert.json.state, 'ack');
  assert.equal((await dispatch(alerts, 'GET', '/api/alerts/events?state=ack')).json.length, 1);
  assert.equal((await dispatch(alerts, 'DELETE', '/api/alerts/events/alert-event-1')).status, 405);
  assert.equal((await dispatch(alerts, 'PATCH', '/api/alerts/events/unknown', { state: 'ack' })).status, 404);
  assert.equal((await dispatch(alerts, 'GET', '/api/alerts/events/alert-event-1/unknown')).status, 404);

  const createdRule = await dispatch(rules, 'POST', '/api/watch-rules', {
    name: 'Fixture-created rule',
    signal_type: 'qa_gate',
    enabled: true,
    paused: false,
    issuer_id: null,
    portfolio_id: null,
    schedule_kind: 'event_driven',
    schedule_interval_seconds: null,
    next_evaluation_at: null,
    config: { operator: 'present', threshold: null, kind: 'qa_gate', title: 'Fixture title', impact: 'Fixture impact' },
  });
  assert.equal(createdRule.status, 201);
  const updatedRule = await dispatch(rules, 'PATCH', `/api/watch-rules/${createdRule.json.id}`, {
    expected_version: 1,
    patch: { ...createdRule.json, name: 'Fixture-updated rule' },
  });
  assert.equal(updatedRule.json.name, 'Fixture-updated rule');
  assert.equal(updatedRule.json.current_version, 2);
  assert.equal((await dispatch(rules, 'POST', `/api/watch-rules/${createdRule.json.id}/evaluate`)).status, 200);
  assert.equal((await dispatch(rules, 'DELETE', `/api/watch-rules/${createdRule.json.id}`)).status, 405);
  assert.equal((await dispatch(rules, 'GET', '/api/watch-rules/unknown')).status, 404);
  assert.equal((await dispatch(rules, 'GET', '/api/watch-rules/unknown/path')).status, 404);

  const second = fixtureTarget();
  await installSurfaceStubs(second, { id: 'second-fixture-user' });
  const cleanAlerts = second.handlers.get('**/api/alerts/events**');
  const cleanRules = second.handlers.get('**/api/watch-rules**');
  assert.equal((await dispatch(cleanAlerts, 'GET', '/api/alerts/events')).json[0].state, 'open');
  assert.equal((await dispatch(cleanRules, 'GET', '/api/watch-rules')).json.length, 1);
});
