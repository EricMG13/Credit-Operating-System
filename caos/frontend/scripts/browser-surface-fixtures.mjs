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

export async function installSurfaceStubs(target, identity) {
  let currentAgenda = { ...agendaItem };
  let currentDecision = { ...decisionItem };
  await target.route('**/api/auth/me', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(identity),
  }));
  await target.route('**/api/issuers/iss-1/profile', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(profile),
  }));
  await target.route('**/api/issuers', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([profile.issuer]),
  }));
  await target.route('**/api/issuers/', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([profile.issuer]),
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
      role_view: 'analyst',
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
      },
    }),
  }));
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
}
