# E5 — final-gate security rerun on the post-C3 diff — 2026-07-22

E5 kept the item open "until the full post-C3/C5/E2/E3 diff is rerun." The
shipped diff since the 2026-07-12 gate is **only the C3 Monitor/alert seam**
(C5 rescoped out to H4; E2 legacy-route roles and E3 audit trail are
post-freeze, not in the frozen candidate). This is that rerun, scoped to the
new attack surface.

## Scope reviewed

`watch_rules.py`, `alert_dispatch.py`, `alert_triggers.py`,
`alert_evaluation.py`, `alert_sinks.py`, `reconcile_alert_rules.py`,
`routes/watch_rules.py`, `routes/alerts.py` — plus the identity/tenancy
helpers they call.

## Result — no HIGH/MEDIUM findings above the confidence bar

Adversarial `/security-review` pass (find → filter). Verified clean:

- **Injection**: all DB access is parameterized SQLAlchemy ORM; no dynamic
  SQL, `eval`/`exec`/`pickle`/`yaml`/`subprocess` in scope; no filesystem
  paths. Wire input passes frozen strict Pydantic (`extra="forbid"`, bounded
  UTF-8, canonical finite JSON rejecting U+0000, is_finite/`_reject_bool`).
- **AuthZ / cross-tenant / IDOR**: writes require owner-or-(tenant-scoped)
  admin AND `tenant_id == caller-scope`; manual-evaluate forces
  `subject_scope` from the persisted rule (no caller-injected foreign
  tenant/issuer/portfolio); `claim_rule_evaluation` re-asserts scope;
  `observation_key` hashes the caller's own `watch_rule_id` (no cross-analyst
  claim suppression); `_alert_visibility_predicate` tenant-scopes reads and
  `c3:` alert_keys embed tenant_id.
- **Crypto/secrets**: list cursors are HMAC-SHA256 over `session_secret`,
  verified with `hmac.compare_digest` before decode and fingerprint-bound to
  caller+filters; scope predicate re-applied regardless of cursor contents;
  no secret in any response payload.
- **Exposure**: logs carry identifiers only; `_safe_error_class` bounds
  renderer exception names to `[A-Za-z0-9_.-]{1,64}`; sinks emit render-intent
  dicts with no transport and no credentials.

The per-PR CI security subset (`pip-audit`, `bandit`, `npm audit --high`,
`gitleaks`) is green on the frozen candidate.

## Below-bar note for the E2 pickup (not a candidate blocker)

`upsert_alert_state` early-returns the C3 capability gate for **legacy**
(non-`c3:`) alert keys, and `AlertState` has no tenant column — so once
`CAOS_TENANCY_ENABLED` is turned on, a write-capable caller could ack/resolve
a legacy autonomy-inbox alert they cannot read. Not cross-tenant for any
`c3:` key; tenancy is off by default; the legacy inbox is outside the C3 seam.
**Hand to E2** (legacy-route roles) as the natural owner when multi-tenant
activates.

## Exit

E5's final rerun is executed against the actual shipped surface. Re-run once
more only if E2/E3 (or any new network/LLM lane) lands before release — those
are post-freeze by the H8 ledger.
