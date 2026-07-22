# EmailSink adapter specification — H4 activation package #1

**Status:** transfer-ready specification. The in-app half is live: C3
materializes durable `email` delivery intents and the leased dispatcher
renders them to terminal `rendered_intent` records (see
[C3_LIVE_OPERATION_EVIDENCE_2026-07-22.md](../qa/C3_LIVE_OPERATION_EVIDENCE_2026-07-22.md)
— an email render intent with subject/body/evidence/authority was produced,
exactly-once, on the frozen candidate). What remains is the **transport**: a
process that takes `rendered_intent` records for channel `email` and hands
them to the enterprise mail system. Nothing upstream changes when transport
lands — that is the activation boundary by design.

## Contract the transport consumes (already shipped, frozen)

`alert_sinks.EmailSink.render` emits, per intent:

| Field | Content |
|---|---|
| `idempotency_key` | stable per (alert, channel, destination) — the transport's dedup key |
| `subject` | alert title |
| `body` | impact statement |
| `credit_kind` | alert kind (e.g. `qa_change`, `dm_jump`) |
| `evidence` / `authority` | bounded JSON — observation key, source identity, watch-rule id/version |
| `destination_ref` | routing token (`owner-email-route`) — resolved to a real address by the transport layer, never stored as a raw address in the intent |

Lifecycle guarantees the transport inherits: claims are leased (SKIP LOCKED),
attempts are bounded (`max_attempts` ≤ 5), a crashed worker never duplicates a
completed send, and a permanently failing intent parks as `not_sent` — it is
never silently retried forever.

## Transport decision

**Primary: Microsoft Graph** (`POST /v1.0/users/{sender}/sendMail`) — the
enterprise is an M365 shop (the Modular OS corpus already has an M365 Copilot
consumer). **Fallback variant: SMTP submission** (RFC 6409, STARTTLS, port
587) for environments without Graph app registrations. Implement Graph first;
keep the sender abstraction thin enough that SMTP is a second class, not a
rewrite.

### Microsoft Graph variant

- **Auth:** client-credentials flow (app registration; `Mail.Send` application
  permission scoped by an application access policy to the single service
  sender mailbox — never tenant-wide send-as).
- **Secrets:** tenant id, client id, client secret/certificate → E4 secrets
  inventory; never logged; masked in any UI.
- **Rate limits:** Graph sendMail is throttled per mailbox (~30 msg/min
  sustained is the safe envelope). The dispatcher already paces (one intent
  per claim); add a transport-side token bucket at 20/min and rely on
  `Retry-After` on 429.
- **Failure taxonomy:** 401/403 → configuration fault (alert operator, stop
  claiming); 429 → backoff and retry within the attempt budget; 5xx → retry;
  400 invalid recipient → terminal `not_sent` with reason.

### SMTP variant

- Submission host + port 587, STARTTLS required, SASL PLAIN over TLS only.
- Credentials in E4 inventory; connection pooled, one message per
  transaction; 4xx = retryable, 5xx = terminal `not_sent`.

## Rendering

The intent's subject/body are terse desk-style text (already rendered — the
transport does NOT re-render). Wrap in the minimal HTML template: monospace
metadata block (issuer, kind, observed-at, authority link back into Monitor),
plain-text alternative part, no external assets (CSP-clean, no tracking).

## Test plan

1. **Unit (offline):** transport class against recorded Graph/SMTP fixtures —
   success, 401, 429 w/ Retry-After, 5xx, invalid recipient; assert the
   intent-state transitions and bounded attempts.
2. **Sandbox activation:** enterprise test tenant/mailbox; send 3 alerts
   (happy, throttled, invalid recipient); verify received rendering, dedup on
   forced double-claim, `not_sent` parking.
3. **Failure rehearsal:** revoke the client secret mid-run → configuration
   fault alert fires, dispatcher stops claiming email intents, in-app channel
   unaffected (fault isolation held in C3 evidence).
4. **Rollback:** disable the email channel (config) → intents park as
   `not_sent`, in-app delivery continues; re-enable → parked intents remain
   parked (no surprise backfill without an explicit operator replay).

## Acceptance

Enterprise IT can implement from this document plus the shipped contract with
no CAOS-side code questions: the sink interface, lease semantics, dedup key,
and failure taxonomy are all named above; secrets go through E4; the
activation flips no default until the sandbox plan passes.
