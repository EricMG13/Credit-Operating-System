// Browser-only fixtures used to inspect data-bearing surfaces in a static
// export. They never change application auth, API clients, or server state.
const profile = {
  issuer: {
    id: 'iss-1', name: 'VMO2', ticker: 'VMO2', sector: 'Telecom',
    country: 'United Kingdom', rating_sp: 'BB-', rating_moody: 'B1', rating_fitch: 'BB',
  },
  latest_run: {
    id: 'run-1', status: 'complete', qa_status: 'Passed', committee_status: 'Committee Ready',
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

export async function installSurfaceStubs(target, identity) {
  await target.route('**/api/auth/me', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(identity),
  }));
  await target.route('**/api/issuers/iss-1/profile', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(profile),
  }));
}
