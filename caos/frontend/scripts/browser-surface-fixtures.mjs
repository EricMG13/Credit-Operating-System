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
    const authority = { origin: 'live', method: 'deterministic-portfolio-v1', freshness: 'current', as_of: '2026-06-30', source_ids: ['portfolio:portfolio-1'], run_id: null, version_id: null, confidence: 1, approval_state: 'draft', analyst_override: null };
    let body;
    if (path.endsWith('/positions')) body = { items: [{ id: 'position-1', portfolio_id: 'portfolio-1', issuer_id: 'iss-1', borrower_name: 'VMO2', ticker: 'VMO2', figi: null, loan_name: 'TLB 2029', sector: 'Telecom', sub_sector: null, ranking: '1L', rating_moody: 'B1', rating_sp: 'BB-', par_usd: 10000000, facility_musd: 500, margin_bps: 425, maturity: '2029', price: 98.5, ytm: 8.1, dm: 510, market_value: 9850000, created_at: '2026-06-30T00:00:00Z' }], total: 1, next_cursor: null, as_of: '2026-06-30', authority };
    else if (path.endsWith('/analytics')) body = { as_of: '2026-06-30', concentration: { n_positions: 1, n_obligors: 1, total_nav: 9850000, total_par: 10000000, sectors: [{ sector: 'Telecom', mv: 9850000, pct_nav: 100, n_obligors: 1 }], rating_dist: [{ bucket: 'B', mv: 9850000, pct_nav: 100, n_obligors: 1 }], top10: [{ obligor: 'VMO2', mv: 9850000, pct_nav: 100 }], top10_pct_nav: 100, wa_rating: 'B1', wa_margin: 425, wa_price: 98.5, first_lien_pct: 100 }, rating_distribution: { B1: 100 }, maturity_wall: { 2029: 9850000 }, risk_budget: { status_counts: { Breach: 0, Watch: 1, Pass: 0, Info: 0 }, headroom: [] }, liquidity: { priced_nav_pct: 100, wa_price: 98.5, unpriced_positions: 0 }, compliance: [], authority, missing_dependencies: [], latest_stress_runs: [] };
    else if (path.endsWith('/stress-runs')) body = { items: [], total: 0, authority };
    else body = [{ id: 'portfolio-1', name: 'Credit Fund I', kind: 'Fund', as_of_date: '2026-06-30', n_positions: 1, total_nav: 10000000, total_par: 10000000, breaches: 0, watches: 1 }];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const fulfillRuns = (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([profile.latest_run]),
  });
  // Axios omits the query delimiter when no issuer filter is supplied. Cover
  // both shapes so the harness never falls through to a developer's live DB.
  await target.route('**/api/runs', fulfillRuns);
  await target.route('**/api/runs?**', fulfillRuns);
  await target.route('**/api/analysis/contexts**', (route) => {
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith('/insights')
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
    let body;
    if (method === 'POST' && url.pathname.endsWith('/finalize')) {
      currentAgenda = { ...currentAgenda, status: 'decided', finalized_decision_id: currentDecision.id, revision: currentAgenda.revision + 1, snapshot_sha256: currentDecision.snapshot_sha256 };
      body = { agenda: currentAgenda, decision: currentDecision };
    } else if (method === 'PATCH') {
      const patch = route.request().postDataJSON();
      currentAgenda = { ...currentAgenda, ...patch, revision: currentAgenda.revision + 1 };
      body = currentAgenda;
    } else if (method === 'POST' && url.pathname.endsWith('/agenda')) {
      const input = route.request().postDataJSON();
      body = { ...agendaItem, ...input, id: 'agenda-created', status: input.status ?? 'draft', revision: 1 };
    } else if (url.pathname.endsWith('/agenda')) {
      body = { items: [currentAgenda], next_cursor: null, total: 1 };
    } else {
      body = currentAgenda;
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await target.route('**/api/decisions/**', (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    let body = currentDecision;
    if (method === 'POST' && url.pathname.endsWith('/votes')) {
      const input = route.request().postDataJSON();
      currentDecision = { ...currentDecision, votes: [{ id: 'vote-1', member: identity.id, vote: input.vote, dissent_note: input.dissent_note ?? null, created_at: '2026-07-13T10:05:00Z' }] };
      body = currentDecision;
    } else if (method === 'POST' && url.pathname.endsWith('/reopen')) {
      const input = route.request().postDataJSON();
      currentDecision = { ...currentDecision, status: 'reopened', reopened_at: '2026-07-13T10:06:00Z', reopen_alert_key: input.trigger_alert_key };
      body = currentDecision;
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await target.route('**/api/decisions?**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: [currentDecision], next_cursor: null, total: 1 }),
  }));
}
