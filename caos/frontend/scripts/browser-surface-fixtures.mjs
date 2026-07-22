// Browser-only fixtures used to inspect data-bearing surfaces in a static
// export. They never change application auth, API clients, or server state.
const profile = {
  issuer: {
    id: 'iss-1', name: 'VMO2', ticker: 'VMO2', sector: 'Telecom',
    country: 'United Kingdom', rating_sp: 'BB-', rating_moody: 'B1', rating_fitch: 'BB',
  },
  latest_run: {
    id: 'run-1', issuer_id: 'a71f0000-0000-0000-0000-000000000001', status: 'complete', qa_status: 'Passed', committee_status: 'Committee Ready',
    as_of_date: '2026-06-30', analyst_id: 'capture', model_mode: null,
    created_at: '2026-06-30T10:00:00Z', completed_at: '2026-06-30T10:05:00Z',
  },
  runs: [],
  metrics: [
    { metric_key: 'net_leverage', period: 'FY2024', value: 5.0, unit: 'x', basis: null, provenance: 'run', headline: false, qa_status: 'Passed', source_claim_id: null, source_evidence_id: null, document_chunk_id: null },
    { metric_key: 'net_leverage', period: 'FY2025', value: 5.2, unit: 'x', basis: null, provenance: 'run', headline: true, qa_status: 'Passed', source_claim_id: null, source_evidence_id: null, document_chunk_id: null },
  ],
  signals: {}, coverage: {}, findings: {}, business: [], sponsor: {}, strengths: [], weaknesses: [],
  earnings: { latest_period: null, prior_period: null, revenue_growth_pct: null, ebitda_growth_pct: null, margin_change_pp: null, monitoring_signals: [] },
};
const referenceProfile = {
  ...profile,
  issuer: {
    ...profile.issuer,
    id: 'a71f0000-0000-0000-0000-000000000001',
    name: 'Atlas Forge',
    ticker: 'ATLF',
  },
};

const analysisContext = {
  id: 'context-1', name: 'IC Book capture', sector_id: null, sub_segments: [],
  issuer_ids: ['iss-1'], instrument_ids: [], portfolio_scope: 'portfolio-1',
  as_of: '2026-06-30', sector_review_run_id: null, rv_snapshot_id: null,
  rv_run_id: null, query_session_id: null,
  artifacts: {
    issuer_run_id: 'run-1', source_manifest_id: null, research_job_id: null,
    model_checkpoint_id: 'model-1', report_version_id: 'report-1',
    alert_event_id: null, sponsor_id: null, portfolio_id: 'portfolio-1',
    decision_id: null, insight_id: null,
  },
  surface_state: {}, filters: {}, selected: {},
  created_at: '2026-07-13T10:00:00Z', updated_at: '2026-07-13T10:00:00Z',
};

const agendaItem = {
  id: 'agenda-1', issuer_id: 'iss-1', portfolio_id: 'portfolio-1', owner_id: 'capture-local',
  scheduled_for: '2026-07-20T09:00:00Z', expiry: '2026-12-31', recommendation: 'approve', conviction: 72,
  thesis: 'FCF conversion supports a staged position with a hard leverage re-test.',
  conditions: ['Re-test leverage after Q3 results', 'No add before covenant certificate'],
  run_id: 'run-1', report_version_id: 'report-1', context_id: 'context-1', status: 'ready',
  revision: 2, readiness_failures: [], finalized_decision_id: null, snapshot_sha256: null,
  frozen_authority: {}, created_at: '2026-07-13T10:00:00Z',
  updated_at: '2026-07-13T10:00:00Z', finalized_at: null,
};

const decisionItem = {
  id: 'decision-1', issuer_id: 'iss-1', portfolio_id: 'portfolio-1', agenda_item_id: 'agenda-1',
  report_id: 'report-1', report_version_id: 'report-1', run_id: 'run-1', action: 'approve',
  status: 'active', conditions: agendaItem.conditions, expiry: '2026-12-31',
  snapshot: { agenda: { thesis: agendaItem.thesis }, authority: { approval_state: 'ratified', as_of: '2026-07-13T10:00:00Z', source_ids: ['run-1', 'report-1'] } },
  snapshot_sha256: 'frozen-capture-sha256', created_by: 'capture-local', reopened_at: null,
  reopen_alert_key: null, created_at: '2026-07-13T10:00:00Z', votes: [],
};

const persistedAlertEvent = {
  id: 'alert-event-1',
  alert_key: 'c3:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  issuer_id: 'iss-1',
  run_id: 'run-1',
  kind: 'qa_gate',
  title: 'Liquidity evidence requires review',
  impact: 'Review the governed liquidity evidence before committee clearance.',
  evidence: {
    observed_at: '2026-07-20T09:00:00Z',
    source_artifact_refs: ['run:run-1'],
  },
  authority: { watch_rule_id: '7f9e2d1c-4b3a-4e65-9d87-1a2b3c4d5e6f', rule_version: 1 },
  state: 'open',
  assignee: null,
  note: null,
  resolved_at: null,
  resolution_note: null,
  created_at: '2026-07-20T09:01:00Z',
  updated_at: '2026-07-20T09:01:00Z',
};

const persistedWatchRule = {
  id: '7f9e2d1c-4b3a-4e65-9d87-1a2b3c4d5e6f',
  name: 'Liquidity evidence gate',
  signal_type: 'qa_gate',
  enabled: true,
  paused: false,
  issuer_id: 'iss-1',
  portfolio_id: null,
  can_mutate: true,
  current_version: 1,
  schedule_kind: 'event_driven',
  schedule_interval_seconds: null,
  next_evaluation_at: null,
  last_evaluated_at: '2026-07-20T09:00:00Z',
  config: {
    operator: 'present',
    threshold: null,
    kind: 'qa_gate',
    title: 'Liquidity evidence requires review',
    impact: 'Review the governed liquidity evidence before committee clearance.',
  },
  created_at: '2026-07-20T08:55:00Z',
  updated_at: '2026-07-20T09:00:00Z',
};

function agendaOperation(method, path) {
  const resource = path.endsWith('/finalize') ? 'finalize' : path.endsWith('/agenda') ? 'agenda' : 'item';
  return `${method}:${resource}`;
}

function createdAgenda(input) {
  return { ...agendaItem, ...input, id: 'agenda-created', status: input.status ?? 'draft', revision: 1 };
}

function agendaRouteResult(operation, input, currentAgenda, currentDecision) {
  const special = {
    'POST:finalize': () => {
    const agenda = { ...currentAgenda, status: 'decided', finalized_decision_id: currentDecision.id, revision: currentAgenda.revision + 1, snapshot_sha256: currentDecision.snapshot_sha256 };
    return { agenda, body: { agenda, decision: currentDecision } };
    },
    'POST:agenda': () => ({ agenda: currentAgenda, body: createdAgenda(input) }),
  }[operation];
  if (operation.startsWith('PATCH:')) {
    const agenda = { ...currentAgenda, ...input, revision: currentAgenda.revision + 1 };
    return { agenda, body: agenda };
  }
  if (special) return special();
  const body = operation.endsWith(':agenda') ? { items: [currentAgenda], next_cursor: null, total: 1 } : currentAgenda;
  return { agenda: currentAgenda, body };
}

function portfolioFixtureBody(path) {
  const authority = { origin: 'live', method: 'deterministic-portfolio-v1', freshness: 'current', as_of: '2026-06-30', source_ids: ['portfolio:portfolio-1'], run_id: null, version_id: null, confidence: 1, approval_state: 'draft', analyst_override: null };
  const position = { id: 'position-1', portfolio_id: 'portfolio-1', issuer_id: 'iss-1', borrower_name: 'VMO2', ticker: 'VMO2', figi: null, loan_name: 'TLB 2029', sector: 'Telecom', sub_sector: null, ranking: '1L', rating_moody: 'B1', rating_sp: 'BB-', par_usd: 10000000, facility_musd: 500, margin_bps: 425, maturity: '2029', price: 98.5, ytm: 8.1, dm: 510, market_value: 9850000, created_at: '2026-06-30T00:00:00Z' };
  const routes = [
    ['/command', () => ({ portfolio: { id: 'portfolio-1', name: 'Credit Fund I', kind: 'Fund', as_of_date: '2026-06-30' }, positions: [{ ...position, posture: 'NEUTRAL', run_id: 'run-1', qa_status: 'Passed', committee_status: 'Committee Ready' }], posture_counts: { OVERWEIGHT: 0, NEUTRAL: 1, UNDERWEIGHT: 0, UNKNOWN: 0 }, position_count: 1, as_of: '2026-06-30', authority })],
    ['/positions', () => ({ items: [position], total: 1, next_cursor: null, as_of: '2026-06-30', authority })],
    ['/analytics', () => ({ as_of: '2026-06-30', concentration: { n_positions: 1, n_obligors: 1, total_nav: 9850000, total_par: 10000000, sectors: [{ sector: 'Telecom', mv: 9850000, pct_nav: 100, n_obligors: 1 }], rating_dist: [{ bucket: 'B', mv: 9850000, pct_nav: 100, n_obligors: 1 }], top10: [{ obligor: 'VMO2', mv: 9850000, pct_nav: 100 }], top10_pct_nav: 100, wa_rating: 'B1', wa_margin: 425, wa_price: 98.5, first_lien_pct: 100 }, rating_distribution: { B1: 100 }, maturity_wall: { 2029: 9850000 }, risk_budget: { status_counts: { Breach: 0, Watch: 1, Pass: 0, Info: 0 }, headroom: [] }, liquidity: { priced_nav_pct: 100, wa_price: 98.5, unpriced_positions: 0 }, compliance: [], authority, missing_dependencies: [], latest_stress_runs: [] })],
    ['/stress-runs', () => ({ items: [], total: 0, authority })],
  ];
  const match = routes.find(([suffix]) => path.endsWith(suffix));
  return match ? match[1]() : [{ id: 'portfolio-1', name: 'Credit Fund I', kind: 'Fund', as_of_date: '2026-06-30', n_positions: 1, total_nav: 10000000, total_par: 10000000, breaches: 0, watches: 1 }];
}

function decisionOperation(method, path) {
  if (method !== 'POST') return null;
  if (path.endsWith('/votes')) return 'votes';
  if (path.endsWith('/reopen')) return 'reopen';
  return null;
}

function decisionRouteResult(operation, input, currentDecision, identity) {
  const updates = {
    votes: () => ({ ...currentDecision, votes: [{ id: 'vote-1', member: identity.id, vote: input.vote, dissent_note: input.dissent_note ?? null, created_at: '2026-07-13T10:05:00Z' }] }),
    reopen: () => ({ ...currentDecision, status: 'reopened', reopened_at: '2026-07-13T10:06:00Z', reopen_alert_key: input.trigger_alert_key }),
  };
  return operation ? updates[operation]() : currentDecision;
}

function cloneFixture(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixtureJson(route, status, body, headers = {}) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers,
    body: JSON.stringify(cloneFixture(body)),
  });
}

function fixtureRequestBody(request) {
  try {
    return request.postDataJSON() ?? {};
  } catch {
    return {};
  }
}

export async function installSurfaceStubs(target, identity) {
  let currentAgenda = { ...agendaItem };
  let currentDecision = { ...decisionItem };
  let currentAlertEvents = [cloneFixture(persistedAlertEvent)];
  let currentWatchRules = [cloneFixture(persistedWatchRule)];
  let createdWatchRuleCount = 0;
  await target.route('**/api/auth/me', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(identity),
  }));
  await target.route('**/api/issuers/iss-1/profile', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(profile),
  }));
  await target.route('**/api/issuers/a71f0000-0000-0000-0000-000000000001/profile', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(referenceProfile),
  }));
  await target.route('**/api/issuers', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([profile.issuer]),
  }));
  await target.route('**/api/issuers/', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([profile.issuer]),
  }));
  await target.route('**/api/issuers/*/analyst-opinions', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ current: null, items: [] }),
  }));
  await target.route('**/api/portfolios**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = portfolioFixtureBody(path);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await target.route('**/api/notifications', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], next_cursor: null }),
  }));
  await target.route('**/api/settings/analyst', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      model_lanes: {},
      email_intelligence: { outlook_connected: false, approved_senders: [] },
      role_view: identity.role_view ?? 'analyst',
      workspace: {},
      revision: 0,
    }),
  }));
  await target.route('**/api/settings', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    // Keep the browser fixture structurally identical to WorkspaceSettings.
    // A partial object makes the Settings surface throw before axe can scan it,
    // turning a verification harness gap into a misleading product-page error.
    body: JSON.stringify({
      model: 'fixture-model',
      llm_configured: false,
      gemini_configured: false,
      openrouter_configured: false,
      governance: {
        council_enabled: false,
        council_seats: 0,
        council_peer_round: false,
        council_cross_model: false,
        debate_enabled: false,
      },
      model_tiers: { cheap: 'fixture', fast: 'fixture', strong: 'fixture', top: 'fixture' },
      engine_cost: {
        run_token_budget: 0,
        advisor_enabled: false,
        synth_executor_model: 'fixture',
        advisor_model: 'fixture',
      },
      deep_research: { effort: 'medium', max_searches: 0, max_tokens: 0 },
      retrieval: { edgar_enabled: false, markitdown_enabled: false },
      workspace: { environment: 'static-verification', demo_seed: true, max_upload_mb: 25, run_concurrency: 1 },
      features: {
        lineage_v2_enabled: false,
        market_xlsx_v2_enabled: false,
        model_engine_v2: false,
        model_engine_v2_enabled: false,
        alert_rules_v1_enabled: true,
      },
    }),
  }));
  const autonomyDraft = {
    status: 'draft', ai_generated: true, ratified: false, export_allowed: false,
    marking: 'AI-GENERATED, UNRATIFIED', generated_at: '2026-07-20T09:00:00Z', refreshing: false,
    sections: [{
      issuer_id: 'iss-1', issuer_name: 'VMO2', max_severity: 0.9,
      claims: [{ text: 'Liquidity headroom narrowed after the latest reporting update', claim_type: 'anomaly', anomaly_kind: 'period-change', anomaly_severity: 0.9, chunk_ids: [], fact_ids: [], model: 'fixture-model' }],
      deterministic_bullets: [], exhibit: [],
    }],
    summary: { n_sections: 1, n_claims: 1, n_deterministic_bullets: 0, n_anomalies: 1 },
  };
  const fulfillAutonomy = (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(autonomyDraft) });
  await target.route('**/api/autonomy/draft', fulfillAutonomy);
  await target.route('**/api/autonomy/draft?**', fulfillAutonomy);
  const fulfillAlertStates = (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  await target.route('**/api/alerts/state', fulfillAlertStates);
  await target.route('**/api/alerts/state?**', fulfillAlertStates);
  await target.route('**/api/alerts/events**', (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const base = '/api/alerts/events';
    const relative = url.pathname.slice(base.length);
    if (!url.pathname.startsWith(base)) return fixtureJson(route, 404, { detail: 'Unknown alert-event fixture path' });
    if (relative === '') {
      if (method !== 'GET') return fixtureJson(route, 405, { detail: 'Method not allowed' });
      const items = url.searchParams.has('cursor') ? [] : currentAlertEvents.filter((event) => (
        (!url.searchParams.has('state') || url.searchParams.get('state') === event.state)
        && (!url.searchParams.has('issuer_id') || url.searchParams.get('issuer_id') === event.issuer_id)
        && (!url.searchParams.has('kind') || url.searchParams.get('kind') === event.kind)
      ));
      return fixtureJson(route, 200, items);
    }
    const segments = relative.split('/').filter(Boolean).map(decodeURIComponent);
    if (segments.length !== 1) return fixtureJson(route, 404, { detail: 'Unknown alert-event fixture path' });
    const index = currentAlertEvents.findIndex((event) => event.id === segments[0]);
    if (index < 0) return fixtureJson(route, 404, { detail: 'Alert event not found' });
    if (method === 'GET') return fixtureJson(route, 200, currentAlertEvents[index]);
    if (method !== 'PATCH') return fixtureJson(route, 405, { detail: 'Method not allowed' });
    const input = fixtureRequestBody(request);
    const previous = currentAlertEvents[index];
    const next = {
      ...previous,
      state: input.state ?? previous.state,
      assignee: input.assignee === undefined ? previous.assignee : input.assignee,
      note: input.note === undefined ? previous.note : input.note,
      resolution_note: input.resolution_note === undefined ? previous.resolution_note : input.resolution_note,
      resolved_at: input.state === 'resolved' ? '2026-07-20T09:02:00Z' : previous.resolved_at,
      updated_at: '2026-07-20T09:02:00Z',
    };
    currentAlertEvents = currentAlertEvents.map((event, eventIndex) => eventIndex === index ? next : event);
    return fixtureJson(route, 200, next);
  });
  await target.route('**/api/watch-rules**', (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const base = '/api/watch-rules';
    const relative = url.pathname.slice(base.length);
    const canCreateHeaders = { 'X-Watch-Rule-Can-Create': 'true' };
    if (!url.pathname.startsWith(base)) return fixtureJson(route, 404, { detail: 'Unknown watch-rule fixture path' });
    if (relative === '') {
      if (method === 'GET') {
        return fixtureJson(route, 200, url.searchParams.has('cursor') ? [] : currentWatchRules, canCreateHeaders);
      }
      if (method !== 'POST') return fixtureJson(route, 405, { detail: 'Method not allowed' });
      const input = fixtureRequestBody(request);
      createdWatchRuleCount += 1;
      const created = {
        ...cloneFixture(input),
        id: `fixture-watch-rule-${createdWatchRuleCount}`,
        can_mutate: true,
        current_version: 1,
        last_evaluated_at: null,
        created_at: '2026-07-20T09:03:00Z',
        updated_at: '2026-07-20T09:03:00Z',
      };
      currentWatchRules = [...currentWatchRules, created];
      return fixtureJson(route, 201, created, canCreateHeaders);
    }
    const segments = relative.split('/').filter(Boolean).map(decodeURIComponent);
    if (segments.length < 1 || segments.length > 2) return fixtureJson(route, 404, { detail: 'Unknown watch-rule fixture path' });
    const index = currentWatchRules.findIndex((rule) => rule.id === segments[0]);
    if (index < 0) return fixtureJson(route, 404, { detail: 'Watch rule not found' });
    const previous = currentWatchRules[index];
    if (segments.length === 2) {
      if (segments[1] !== 'evaluate') return fixtureJson(route, 404, { detail: 'Unknown watch-rule fixture path' });
      if (method !== 'POST') return fixtureJson(route, 405, { detail: 'Method not allowed' });
      const evaluated = { ...previous, last_evaluated_at: '2026-07-20T09:04:00Z', updated_at: '2026-07-20T09:04:00Z' };
      currentWatchRules = currentWatchRules.map((rule, ruleIndex) => ruleIndex === index ? evaluated : rule);
      return fixtureJson(route, 200, {
        rule_id: evaluated.id,
        evaluated_at: evaluated.last_evaluated_at,
        emitted_event_ids: [],
      });
    }
    if (method === 'GET') return fixtureJson(route, 200, previous, canCreateHeaders);
    if (method !== 'PATCH') return fixtureJson(route, 405, { detail: 'Method not allowed' });
    const input = fixtureRequestBody(request);
    if (input.expected_version !== previous.current_version) {
      return fixtureJson(route, 409, { detail: 'Watch rule version conflict' });
    }
    const next = {
      ...previous,
      ...cloneFixture(input.patch ?? {}),
      id: previous.id,
      can_mutate: previous.can_mutate,
      current_version: previous.current_version + 1,
      created_at: previous.created_at,
      updated_at: '2026-07-20T09:05:00Z',
    };
    currentWatchRules = currentWatchRules.map((rule, ruleIndex) => ruleIndex === index ? next : rule);
    return fixtureJson(route, 200, next, canCreateHeaders);
  });
  const portfolioBoard = {
    rows: [{ issuer_id: 'iss-1', name: 'VMO2', ticker: 'VMO2', sector: 'Telecom', run_id: 'run-1', qa_status: 'Passed', committee_status: 'Committee Ready', as_of: '2026-06-30', metrics: {}, rv_recommendation: null, rv_percentile: null, downside_fragility: null, gaps: [] }],
    issuer_count: 1, covered_count: 1,
  };
  const fulfillPortfolioBoard = (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(portfolioBoard) });
  await target.route('**/api/portfolio', fulfillPortfolioBoard);
  await target.route('**/api/portfolio?**', fulfillPortfolioBoard);
  const digest = { as_of: '2026-07-20T09:00:00Z', coverage: { issuers: 1 }, stale_threshold_days: 30, stale: [], warf: null, warf_band: null, ccc_watch: [], qa: {}, activity_24h: {} };
  const fulfillDigest = (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(digest) });
  await target.route('**/api/digest/daily', fulfillDigest);
  await target.route('**/api/digest/daily?**', fulfillDigest);
  const ingestionGaps = { as_of: '2026-07-20T09:00:00Z', truncated: false, zero_chunk: [], ocr_lane: [], coverage: [{ issuer_id: 'iss-1', issuer_name: 'VMO2', analyst_owner: 'Task 4C Workflow Gate', origins: ['NATIVE'], document_count: 3 }] };
  const fulfillIngestionGaps = (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ingestionGaps) });
  await target.route('**/api/digest/ingestion-gaps', fulfillIngestionGaps);
  await target.route('**/api/digest/ingestion-gaps?**', fulfillIngestionGaps);
  const qaFindings = [{ id: 'qa-finding-1', finding_id: 'qa-finding-1', run_id: 'run-1', issuer_id: 'iss-1', issuer: 'VMO2', ticker: 'VMO2', module_id: 'CP-5', severity: 'MATERIAL', lane: 5, description: 'Confirm liquidity headroom evidence before committee clearance.', affected_claim_id: null, required_remediation: 'Attach the latest reporting support and rerun CP-5.', as_of: '2026-07-20T09:00:00Z' }];
  const fulfillQaFindings = (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(qaFindings) });
  await target.route('**/api/qa/findings', fulfillQaFindings);
  await target.route('**/api/qa/findings?**', fulfillQaFindings);
  await target.route('**/api/query/capabilities', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      groups: [{
        id: 'verification',
        label: 'Verification',
        icon: 'query',
        ready: 4,
        total: 4,
        capabilities: [
          { id: 'peer-set', label: 'Peer set', mode: 'peers', enabled: true, reason: null },
          { id: 'scatter', label: 'Scatter', mode: 'scatter', enabled: true, reason: null },
          { id: 'trace-source', label: 'Source trace', mode: 'provenance', enabled: true, reason: null },
          { id: 'open-findings', label: 'Open findings', mode: 'findings', enabled: true, reason: null },
        ],
      }],
      availability: { model_lane: false },
    }),
  }));
  const fulfillRuns = (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([profile.latest_run]),
  });
  // Axios omits the query delimiter when no issuer filter is supplied. Cover
  // both shapes so the harness never falls through to a developer's live DB.
  await target.route('**/api/runs', fulfillRuns);
  await target.route('**/api/runs?**', fulfillRuns);
  // Pipeline promotes the list fixture's latest row into an exact persisted
  // run read. Stub that authority boundary as well; otherwise browser audits
  // silently fall through to a developer's API and never reach the workbench.
  await target.route('**/api/runs/run-1', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: 'run-1',
      issuer_id: 'a71f0000-0000-0000-0000-000000000001',
      status: 'complete',
      qa_status: 'Passed',
      committee_status: 'Committee Ready',
      as_of_date: '2026-06-30',
      model_id: null,
      prompt_version: null,
      error: null,
      modules: [
        { module_id: 'CP-0', module_name: 'Document intake', qa_status: 'Passed', committee_status: 'Committee Ready', confidence: 'High', validation_status: 'Passed' },
        { module_id: 'CP-1', module_name: 'Credit fact base', qa_status: 'Passed', committee_status: 'Committee Ready', confidence: 'High', validation_status: 'Passed' },
        { module_id: 'CP-X', module_name: 'Route plan', qa_status: 'Passed', committee_status: 'Committee Ready', confidence: 'High', validation_status: 'Passed' },
      ],
    }),
  }));
  const moduleDetail = (moduleId) => ({
    module_id: moduleId,
    module_name: moduleId,
    owned_object: null,
    schema_family: 'fixture',
    runtime_output: {},
    confidence: 'Not Assessed',
    qa_status: 'Not Reviewed',
    committee_status: 'Committee Ready',
    validation_status: 'Not Reviewed',
    limitation_flags: [],
    downstream_consumers: [],
    claims: [],
  });
  // Reference-route reads that intentionally have no persisted analytical
  // payload still receive valid empty responses. Returning static-server 404s
  // here makes browser diagnostics report harness noise as application faults.
  await target.route('**/api/runs/run-1/modules', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await target.route('**/api/runs/run-1/modules/*', (route) => {
    const moduleId = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(moduleDetail(moduleId)) });
  });
  await target.route('**/api/runs/run-1/qa', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ run_id: 'run-1', qa_status: 'Passed', committee_status: 'Committee Ready', findings_by_severity: {}, findings: [] }),
  }));
  await target.route('**/api/runs/run-1/freshness', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      run_id: 'run-1',
      evaluated_at: '2026-06-30T10:05:00Z',
      evaluation: {
        state: 'current', source_kind: 'run', observed_at: '2026-06-30T10:05:00Z',
        effective_period_end: '2026-06-30', expected_next_at: null, due_at: null,
        age_days: 0, reason: 'Static browser verification fixture', policy_version: 'fixture-v1',
      },
    }),
  }));
  await target.route('**/api/models/a71f0000-0000-0000-0000-000000000001', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: 'null',
  }));
  await target.route('**/api/reports/drafts/context-1', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: 'null',
  }));
  await target.route('**/api/qa/flags?**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await target.route('**/api/analysis/contexts**', (route) => {
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith('/freshness')
      ? { context_id: analysisContext.id, evaluated_at: '2026-06-30T10:05:00Z', artifacts: [] }
      : url.pathname.endsWith('/insights')
      ? { items: [], current: null, next_cursor: null }
      : analysisContext;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await target.route('**/api/analysis/findings**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await target.route('**/api/committee/agenda**', (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const input = method === 'POST' || method === 'PATCH' ? route.request().postDataJSON() ?? {} : {};
    const result = agendaRouteResult(agendaOperation(method, url.pathname), input, currentAgenda, currentDecision);
    currentAgenda = result.agenda;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result.body) });
  });
  await target.route('**/api/decisions/**', (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const operation = decisionOperation(method, url.pathname);
    const input = operation ? route.request().postDataJSON() : {};
    currentDecision = decisionRouteResult(operation, input, currentDecision, identity);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(currentDecision) });
  });
  await target.route('**/api/decisions?**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: [currentDecision], next_cursor: null, total: 1 }),
  }));
  await target.route('**/api/query/graph', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      capability_id: 'fixture-empty', mode: 'provenance', title: 'No fixture query executed',
      nodes: [], edges: [], meta: [], caveats: ['Static browser verification fixture'],
    }),
  }));
  await target.route('**/api/query/runs?**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await target.route('**/api/thesis?**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await target.route('**/api/issuers/*/freshness', (route) => {
    const issuerId = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-2));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ issuer_id: issuerId, evaluated_at: '2026-06-30T10:05:00Z', evaluations: [] }),
    });
  });
  await target.route('**/api/models/*/checkpoints', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await target.route('**/api/analysis/taxonomy', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ sectors: [{ id: 'telecom', label: 'Telecom', aliases: ['Telecommunications'] }] }),
  }));
  await target.route('**/api/sector/feeds', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await target.route('**/api/sector/reviews?**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await target.route('**/api/sponsors/*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ sponsor: 'Fixture Sponsor', issuer_count: 0, avg_governance_risk_score: null, flag_counts: {}, issuers: [] }),
  }));
  await target.route('**/api/sponsors/', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
}
