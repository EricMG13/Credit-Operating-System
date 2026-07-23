# Security Review Matrix

> **2026-07-20 update:** application security regressions pass in the current
> effective server evidence, and policy/pool controls have been consolidated,
> but target encryption, retention/legal hold, backup freshness/alerting, and
> remote-only recovery remain release blockers. See
> [PRE_DEPLOYMENT_UPDATE_2026-07-20.md](reports/PRE_DEPLOYMENT_UPDATE_2026-07-20.md).

> **2026-07-18 release note:** this matrix is retained as a finding register,
> not a current deployment verdict. Edge-origin enforcement, tenancy, roles,
> and route coverage have evolved since some rows were written; each surviving
> finding must be re-adjudicated against the immutable candidate. The release
> security decision also requires target encryption, backup recovery, egress,
> and isolation evidence that a source matrix cannot supply. See
> [PRE_DEPLOYMENT_CLOSURE_2026-07-18.md](reports/PRE_DEPLOYMENT_CLOSURE_2026-07-18.md)
> and L18/L26.

Verified-findings audit across the CAOS FastAPI server route endpoints and security posture. Each audited item was reviewed against the lenses and live code; findings below survived adversarial verification.

## 1. Audit status

| Item | Status | Verified findings |
|------|--------|-------------------|
| auth.py | AUDITED | 1 |
| chat.py | AUDITED | 0 |
| digest.py | AUDITED | 0 |
| edgar.py | AUDITED | 0 |
| health.py | AUDITED | 0 |
| ingestion.py | AUDITED | 0 |
| issuers.py | AUDITED | 0 |
| models.py | AUDITED | 0 |
| portfolio.py | AUDITED | 0 |
| query.py | AUDITED | 1 |
| research.py | AUDITED | 0 |
| runs.py | AUDITED | 0 |
| scenario.py | AUDITED | 0 |
| settings.py | AUDITED | 0 |
| sponsors.py | AUDITED | 0 |
| main+identity | AUDITED | 0 |

## 2. Findings (sorted by severity, high first)

| Severity | Item | File:line | Lens | Summary | Failure |
|----------|------|-----------|------|---------|---------|
| high — **FIXED** | auth.py | caos/server/routes/auth.py:176 | authn/authz on every endpoint / edge-proxy header assumptions | `/api/auth/profile` (`create_profile`) bypasses the edge SSO verification requirement in deployed environments when headers are missing. | The endpoint `create_profile` has no `Depends(get_identity)` dependency and does not check for the presence of proxy-injected headers (`X-Forwarded-Email` / `X-Forwarded-User`) in a deployed context. An attacker who accesses the endpoint directly (bypassing oauth2-proxy, e.g. via network routing misconfiguration or inside the stack network) can authenticate using just the shared `analyst_signup_code` and create/adopt any profile name. The server will mint a signed cookie for the profile. Subsequent requests containing this cookie will then be trusted by the app without validating edge proxy verification headers. |
| med — **FIXED** | query.py | caos/server/routes/query.py:280 | authn/authz / validation | `/api/query/links` GET endpoint returns all accepted links but does not filter by analyst or verify tenant boundaries if multi-tenancy is added, loading all rows. | The `list_accepted_links` endpoint performs a blanket select over the entire `QueryAcceptedLink` table (`select(QueryAcceptedLink)`), which loads all links into memory. While acceptable for a single-team model today, if the workspace is shared or if MNPI boundaries are introduced later, this leaks structural connection data between issuers across analysts. |

## 3. Resolution status (verified 2026-07-23, `/owasp-security` re-audit)

Both findings above are fixed on `main` as of this re-audit — re-verified directly against current source, not carried forward from an earlier claim:

- **auth.py finding** — [routes/auth.py:213](../../server/routes/auth.py) now raises `401` fail-closed: `if is_deployed(settings) and not (sso_email or sso_user): raise HTTPException(...)`. `is_deployed()` ([config.py:367](../../server/config.py)) treats any `environment != "development"` as deployed (asymmetric fail-closed — a typo'd or unset env still gets the guard), so the direct-access bypass described above no longer exists.
- **query.py finding** — [routes/query.py:415](../../server/routes/query.py) now scopes the query through `scope_issuers(select(Issuer.id), caller)` before selecting `QueryAcceptedLink` rows, plus a `limit(1000)`. No more blanket cross-analyst select.

No new HIGH/CRITICAL findings surfaced in this pass. Supplemental checks (app code only, vendor/venv excluded): no `eval`/`exec`/`pickle`/`yaml.load`/`os.system`/`shell=True`; no hardcoded secrets in `server/routes/*.py` or `server/*.py`; password hashing is PBKDF2-HMAC-SHA256 at 600k iterations (OWASP 2023 floor) with constant-time compare; zero `dangerouslySetInnerHTML` in the frontend; CI supply-chain scans (`pip-audit`, `bandit`, `gitleaks`, `npm audit --high`) green.

Still open (carried from the 2026-07-20 pre-deployment matrix, not a code defect — an infra/ops decision): encryption at rest, retention/legal hold, backup freshness/alerting, remote-only recovery remain release blockers. See [PRE_DEPLOYMENT_UPDATE_2026-07-20.md](reports/PRE_DEPLOYMENT_UPDATE_2026-07-20.md).
