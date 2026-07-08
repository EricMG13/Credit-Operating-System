# Secure Performance Frontend — Blueprint

Implementation blueprint for Opus 4.8. Every claim below is evidence-verified (file:line or bundle grep from the authoring session, 2026-07-08). Scope = exactly three objectives: BFF proxy layer, atomic state subscriptions, windowed rendering. Do not widen.

## 0. Architecture ground truth

- The frontend is a **static export** (`output: "export"`, caos/frontend/next.config.js:9) served by FastAPI StaticFiles from `caos/server/static/` — there is **no Next.js server at runtime**. The BFF is the FastAPI app (`caos/server`), fronted by Caddy → oauth2-proxy (deploy/Caddyfile:22-38, header-strip + `X-Edge-Authorization` inject).
- All browser traffic is same-origin `/api/*` via the shared axios client (src/lib/api.ts:8 — no baseURL, no bearer headers; only `X-Model-Mode`/`X-Query-Model` tier names from localStorage).
- Session = HMAC-SHA256-signed cookie minted server-side (routes/auth.py:121-142 → identity.py:68), `httponly, samesite=lax, secure`. Enforcement: `get_identity` dependency (identity.py:116) per-route + `edge_origin_guard` middleware on every `/api/*` except `/api/health` (main.py:225-239).

### Exposure audit result (what needed moving server-side: nothing — keep it that way)

| Checked | Method | Result |
|---|---|---|
| LLM keys (`sk-ant`, `sk-or-`, `ANTHROPIC/OPENROUTER/GEMINI_API` values, `AIza…`) | grep of shipped bundles `caos/frontend/out/` AND `caos/server/static/` | **No values.** Only env-var *names* as settings-page hint labels (src/app/settings/page.tsx:53-55,348-350) |
| DB / vector-store credentials (`postgres://`, `DATABASE_URL`, pgvector DSN) | same bundle grep + src grep | none |
| External AI/DB hosts (`api.anthropic.com`, `openrouter.ai`, `generativelanguage`, `googleapis`) | bundle + src grep | none — zero external fetch targets in client code |
| `process.env` in client code | src grep | one var: `NEXT_PUBLIC_CAOS_DISABLE_LOGIN` (AuthProvider.tsx:51), gated `NODE_ENV !== "production"`; **absent from shipped bundle** (grep, dead-code-eliminated) |
| Analyst signup code `131113` | bundle + src grep | not in client; checked server-side via `hmac.compare_digest` (routes/auth.py:192-198, 245-253); prod boot rejects the dev default (main.py:68-75) |
| Secrets in frontend build | deploy/Dockerfile:11-16 | `npm run build` receives no ARG/ENV; AI/DB env passed only to `app` container (docker-compose.yml:62-86) |

Caveat for implementer: bundle greps above ran against the Jul-7 export; src is newer. **Re-run the scan after any rebuild (Δ1 makes this automatic).**

## 1. BFF proxy layer

All AI/vector credentials already live server-side in `config.py` (pydantic BaseSettings: `anthropic_api_key:66`, `openrouter_api_key:72`, `gemini_api_key:91`, `database_url:32`, `session_secret:63`, `edge_proxy_secret:55`). The routes below are the **canonical proxy contract** — the browser calls them with the session cookie; the server attaches the credential and forwards to the external model / pgvector. No new proxy routes are required; the deltas (Δ1–Δ2) harden and pin this contract.

### 1.1 Route contract (cookie-auth = `Depends(get_identity)` + edge middleware; credential column = what stays server-side)

| Route | Request schema | Response schema | Rate limit | Credential attached server-side | Downstream |
|---|---|---|---|---|---|
| `POST /api/chat/issuer` (routes/chat.py:45) | `ChatRequest{messages: [{role: "user"\|"assistant", content: str≤20000}] 1..32}`, total ≤60k chars | `ChatResponse{reply: str}` | 10/min/analyst | `ANTHROPIC_API_KEY` (llm.py:60-62) | Anthropic Messages API |
| `POST /api/query/answer` (routes/query.py:223) | `AnswerRequest{question: str 1..500, capability_id?: str≤64, issuer_id?: str≤36, force: bool}` | Δ2 pins: `AnswerResponse{answer: str, sentences: list, citations: [{chunk_id, label}], fact_citations: [{fact_id, label}], unavailable: bool, reason?: str, model?: str, created_at?: str, cached?: bool}` — core shape from engine/queryanswer.py:170-181,284; the last three are cache-envelope fields the UI consumes (query/page.tsx:329-333 — verifier-caught: omitting them regresses the AiAnswer display). Before implementing, diff the schema against one live `queryanswer.answer()` payload to catch any other envelope field | 10/min (`_QUERY_MAX_PER_MINUTE`) | `GEMINI_API_KEY` (query embedding, retrieval.py:201-206) + `OPENROUTER_API_KEY`/`ANTHROPIC_API_KEY` (answer synth per X-Model-Mode) | Gemini embeddings + pgvector (via `DATABASE_URL`) + LLM |
| `POST /api/query/route` (routes/query.py:261) | `RouteRequest{text: str 1..500}` | `{candidates: [...], source: "llm"\|"keyword"}` — degrades to `{candidates: [], source: "keyword"}` on any lane failure | 10/min | LLM key per mode | LLM router |
| `POST /api/query/overlay` (routes/query.py:300) | (same lane family; auth :304) | overlay envelope | 10/min | LLM key per mode | LLM |
| `POST /api/query/nl` (routes/query.py:562) | NL walk request | walk envelope | 10/min | LLM key per mode (deterministic fallback) | LLM |
| `POST /api/research` (routes/research.py:47) | `ResearchBrief` | `ResearchJobCreated{id, status}` 201 | 3/min/analyst | LLM + web-search keys server-side | Deep-research executor (background job) |
| `GET /api/research/{job_id}` (routes/research.py:71) | path id | `ResearchJobStatus{id, status: running\|complete\|failed, report?, sources[], demo, truncated, progress?, error?}`; 404 on other analysts' jobs (per-user isolation :80-81) | poll unlimited | — (reads DB) | DB |
| `GET /api/autonomy/draft?force=` (routes/autonomy.py:69) — **no frontend caller today** (grep `autonomy` in src = empty; Command Center UI still renders mock; contract pinned for when it wires) | query param `force: bool` | Δ2 pins draft envelope: `{status, ai_generated, ratified, export_allowed, marking, sections[], summary{n_sections, n_claims, n_deterministic_bullets, n_anomalies}, refreshing, error?}` (shape :49-56,98-105); fault-isolated — never 5xx (:106-108); `current_fingerprints` never serialized (:90) | single-flight advisory lock | Analyst-stage LLM key inside PipelineExecutor | Sentinel→Reporter DAG |
| `POST /api/runs` (routes/runs.py:207) | run create body | `RunSummary` 201 | — | LLM keys inside engine lanes (council CP-5C, debate CP-6A) | CP-X DAG |
| `POST /api/ingestion/*` (routes/ingestion.py:138-143, 332-340) | upload/memo bodies | ingest envelopes | — | `GEMINI_API_KEY` for `embed_chunks_for_document` (background task) | Gemini embeddings → pgvector |
| `POST /api/auth/register` / `POST /api/auth/login` / `GET /api/auth/me` / `POST /api/auth/logout` (routes/auth.py) | code-gated register/login | profile envelope; sets signed cookie | throttled (auth.py:61-67) | `SESSION_SECRET` (signing), `ANALYST_SIGNUP_CODE` (compare_digest) | — |

Auth check, verified per-route: `Depends(get_identity)` present on every LLM/vector route above (chat.py:48, query.py:227/265/304, autonomy.py:73, research.py:51/74, runs.py:212+). No LLM route skips it.

### 1.2 Deltas to implement

**Δ1 — bundle secret-scan gate (regression enforcement).** New `caos/frontend/scripts/bundle-secret-scan.mjs` (node, zero deps, same style as a11y-axe.mjs), run after `next build` over every file in `out/`. **Two independent passes — the allowlist never applies to pass 1** (verifier-caught risk: a naive per-line allowlist would substring-mask `ANTHROPIC_API_KEY=sk-ant-…`):

1. *Value patterns — any hit fails, no exceptions:* `/sk-ant-[0-9A-Za-z-]{8,}|sk-or-[0-9A-Za-z-]{8,}|AIza[0-9A-Za-z_-]{10,}|postgres(ql)?:\/\/[^\s"']+|api\.anthropic\.com|openrouter\.ai|generativelanguage|CAOS_DISABLE_LOGIN/`.
2. *Name patterns:* `/(ANTHROPIC|OPENROUTER|GEMINI)_API_KEY|DATABASE_URL|SESSION_SECRET|EDGE_PROXY_SECRET|ANALYST_SIGNUP_CODE/` — allowed **only** as the exact quoted UI-label forms `reqKey:"<NAME>"` / `hint:"<NAME>"` (name immediately followed by a closing quote, never by `=` or a value) in the settings chunk (`app/settings/page-*.js`); any other occurrence fails.

Exit 1 with file + matched excerpt. Wire as a step in `.github/workflows/ci.yml` after the frontend build, and add a `"postbuild:scan"` npm script so local builds run it too.

**Δ2 — pin the two schema-less LLM responses.** Add FastAPI `response_model` for `POST /api/query/answer` (`AnswerResponse`, fields above) and `GET /api/autonomy/draft` (`AutonomyDraft`, fields above) so the proxy contract is explicit at the OpenAPI seam. Field lists come from engine/queryanswer.py:170-181/284-285 and routes/autonomy.py:49-56 — do not invent extra fields; mark optional exactly what the fallback envelopes omit. `response_model` is an allowlist — it can only narrow the payload: the transient self-correction fields (`drop_rate`, `drop_reasons`) are deliberately excluded from `AnswerResponse`, and `current_fingerprints` never appears in the draft envelope (stays server-side, autonomy.py:90).

Assessed residual (verifier-raised, no change): `runtime_output` in the run-module serializer (routes/runs.py:341) is an unfiltered engine-JSON passthrough — the known CP-5 trust boundary. No credential can enter it today (provider key objects live in the LLM clients, never in module outputs; grep of runs.py shows only `tokens_used` counts), and the bundle scan cannot see runtime data by design. Leave as-is.

Explicitly **not** in scope (would be designing beyond the audit): new Next.js API routes (impossible — static export), rotating credentials, removing the settings hint labels (names, not secrets).

## 2. Atomic state subscriptions

Diagnosis (verified): no polling context exists; data hooks are component-local (useLatestRun.ts:73 fetch-once; sim.ts:56 interval is local to Pipeline Visualizer). The waterfalls are context-value identity + missing bail-outs. `React.memo` count in src: **0**.

| # | Offender (evidence) | Blast radius |
|---|---|---|
| W1 | EvidenceSync: every `EvChip` publishes on `onMouseEnter/onFocus` AND subscribes to the whole `{active,setActive}` value (EvidenceModal.tsx:30-38; provider deepdive/page.tsx:305) | every hover-in/out re-renders all 17 chip instances + SourceRail (rails.tsx:111) + IssuerChat — 2 full waves per hover transition at pointer speed |
| W2 | IssuerProfileOverlayProvider at root (layout.tsx:28): fresh value object + fresh callbacks every render (IssuerProfileOverlay.tsx:96) | all 4 consumers (IssuerLink, GlobalIssuerSearch, issuers/page, upload/steps) re-render on any provider render, app-wide |
| W3 | AuthProvider at root (layout.tsx:26): fresh value literal (AuthProvider.tsx:116); re-resolves on tab `visibilitychange` + `caos:auth-lost` (:104-113) | 4 consumers app-wide re-render every tab refocus |
| W4 | ResponsiveShell provider value fresh literal (ResponsiveShell.tsx:79), mounts on 9 pages | ~0 real consumers today — hygiene fix only |

### Slice patterns to deploy

**S1 — stable-store context + selector subscription (replaces the internals of `src/lib/evidence-sync.tsx`; public semantics preserved: sync only under the provider, inert elsewhere).** The context stops carrying `{active,setActive}` and carries a **store object whose identity never changes**; components subscribe to derived atoms via `useSyncExternalStore` (React 18 built-in — no new dependency):

```tsx
// src/lib/evidence-sync.tsx — rewrite
"use client";
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";

type EvidenceStore = {
  get: () => string | null;
  set: (id: string | null) => void;
  subscribe: (l: () => void) => () => void;
};

function createEvidenceStore(): EvidenceStore {
  let active: string | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => active,
    set(id) { if (id !== active) { active = id; listeners.forEach((l) => l()); } },
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  };
}

const inert: EvidenceStore = { get: () => null, set: () => {}, subscribe: () => () => {} };
const Ctx = createContext<EvidenceStore>(inert);

export function EvidenceSyncProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createEvidenceStore); // stable for provider lifetime
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

/** Atomic per-chip subscription: re-renders ONLY when `active === id` flips. */
export function useEvidenceSynced(id: string): boolean {
  const s = useContext(Ctx);
  return useSyncExternalStore(s.subscribe, () => s.get() === id, () => false);
}
/** Full-value subscription — for the ONE component that needs the id itself (SourceRail). */
export function useActiveEvidence(): string | null {
  const s = useContext(Ctx);
  return useSyncExternalStore(s.subscribe, s.get, () => null);
}
/** Publisher — stable fn, subscribes to nothing. */
export function useSetActiveEvidence() {
  return useContext(Ctx).set;
}
```

Consumer changes: `EvChip` (components/shared/EvidenceModal.tsx:30-38) → `const synced = useEvidenceSynced(id); const setActive = useSetActiveEvidence();` — hover now re-renders exactly 2 chips (leaving + entering) instead of 17+. SourceRail (components/deepdive/rails.tsx:111) → `useActiveEvidence()`. IssuerChat: same swap by need (boolean if it only highlights, value if it seeds text). Delete the old `useEvidenceSync` export after migrating its 3 consumer files (grep `useEvidenceSync(` to confirm none remain).

**S2 — split action/state contexts (replaces single context in `src/components/shared/IssuerProfileOverlay.tsx:22,96`).** Safe to stabilize: all three actions close over only `useState` setters and module constants (`DEMO_UNIVERSE`, `getIssuers`) — verified :41-91, no changing state captured, so `useCallback` with empty deps (and `[openProfile]` for `openProfileByQuery`) cannot go stale. Two contexts: `IssuerProfileActionsCtx = {openProfile, openProfileByQuery, closeProfile}` — all `useCallback([])`-stable, value built once in `useMemo(() => ({...}), [])`; `IssuerProfileStateCtx = {isOpen, issuerId}` — memoized on `[isOpen, issuerId]`. The 4 action-only consumers (issuers/page, GlobalIssuerSearch, IssuerLink, upload/steps) switch to `useIssuerProfileActions()` and stop re-rendering on open/close entirely; only the `IssuerProfileOverlay` panel itself consumes state. Keep a thin `useIssuerProfileOverlay()` compat hook during migration if it shortens the diff, then delete it.

**S3 — memoize the root Auth value (fix in place, `src/components/shared/AuthProvider.tsx:116`).** `const value = useMemo(() => ({ user, loading, error, needsLogin, refresh }), [user, loading, error, needsLogin, refresh])` with `refresh` wrapped `useCallback`. Consumers then re-render only on genuine auth transitions, not on every provider render/tab refocus that resolves to identical state — provided `user` keeps referential identity when unchanged: in the `/api/auth/me` resolver, only `setUser(next)` when identity actually changed (compare `user.id`/updated fields), else skip.

**S4 — one-line hygiene: memoize ResponsiveShell provider value (ResponsiveShell.tsx:79)** on `[breakpoint]`.

**S5 — `React.memo` on virtualized row components only** (the row components named in §3). With windowing, the list parent re-renders every scroll frame; memoized rows keep the frame cost at (rows entering the window) instead of (all visible rows). Do **not** blanket-memo the app.

Explicitly not in scope: new state library (nothing installed, nothing needed — the two patterns above are React built-ins), touching NotificationProvider/AskProvider (values already memoized: Notifications.tsx:19, Ask.tsx:136; verified low-impact).

## 3. Windowed rendering

Verified inventory (seed sizes counted in source): PORTFOLIO 382 tranches (lib/command/data.ts:38), DEMO_UNIVERSE 346 issuers (lib/issuers.ts:7), market-data.json 588 loans → largest sector peer set 166 (IT). No virtualization library installed; the hand-rolled `useVirtualScroll` (src/lib/useVirtualScroll.ts — padding-window, `estimateHeight`, `overscan:10`) is already live in two components and is the pattern to reuse. `React.memo` in src: 0.

| Surface | Rows × nodes/row | Today | Boundary decision |
|---|---|---|---|
| command / PortfolioTable (components/command/views.tsx:493, virtualized :178) | 382 × ~18 | windowed, h33/overscan10 | **none — reference implementation** (~40 active rows ≈ 720 nodes) |
| command / LiveCoverage (views.tsx:96, virtualized :64) | API × ~10 | windowed, h28 | none (~45 rows ≈ 450 nodes) |
| **sector-rv / PeerTable (components/command/SectorRV.tsx:479)** | **166 × ~35 ≈ 5,800 nodes** | **not windowed, no cap**; plus parent-level `hovered`/`selected` state re-renders all 166 rows per pointer move (:481-495) | **V1 — window + memo rows** |
| sector-rv / RVScatter (SectorRV.tsx:905/989) | 166 SVG pts ≈ 1,000 nodes | bounded | **explicit non-boundary** — a scatter's points are the view; culling falsifies the chart. Bounded, renders once per data change |
| issuers register (src/app/issuers/page.tsx:407-411) | 346 × ~13 ≈ 4,500 nodes | native CSS windowing already correct: `[content-visibility:auto] [contain-intrinsic-size:auto_32px]` (:411) inside fixed-height Panel overflow (Panel.tsx:81) | **V2 — keep native windowing; no code change.** Painted budget ≈ viewport rows (~30). Escalate to useVirtualScroll only if the register exceeds ~1,000 rows (multi-portfolio phase) |
| CoverageMatrix (views.tsx:964) | 383 × ~28 ≈ 10,700 nodes | **dead code — never mounted** (only a comment ref :925) | **V3 — guard note:** must not be mounted without the V1 pattern. No work now |
| monitor Email/AlertFeed (views.tsx:683/752) | 9–10 rows, progressive-reveal cap :737 | bounded | none |
| query RelativeValueTable (components/query/RelativeValueTable.tsx:216) | graph-bounded, page slices `.slice(0,5/4/3)` (query/page.tsx:185,464,505) | bounded | none |
| model sheet / deepdive tabs / reports doc / sector cards | ≤60 × small | bounded containers | none |

Charts: 5 `@antv/g2` mount sites; `G2Chart` re-renders on spec change only (charts/G2Chart.tsx:103) — polling does not re-render charts. No chart work.

### V1 — SectorRV PeerTable windowing (the one real change)

- **Where:** `components/command/SectorRV.tsx` — tbody map at :479; scroll container is the `overflow-auto h-full` div at :1538 inside the fixed `h-[400px]` PanelShell (:1531).
- **Mechanics:** reuse `useVirtualScroll({ itemCount: sorted.length, estimateHeight: 32, overscan: 10, containerRef })` (row = `py-[7px]` + text-xs ≈ 32px; verify against computed height once in devtools and adjust the constant). Real `<table>` semantics are kept with two `aria-hidden` spacer rows: `<tr aria-hidden style={{height: paddingTop}}><td colSpan={visibleColCount}/></tr>` before the slice, same with `paddingBottom` after; render `sorted.slice(startIndex, endIndex + 1)`. Sticky first-column cells and `<thead>` (already sticky) are unaffected.
- **Row extraction + memo (S5 applied here):** lift the inline row JSX (:479-…) into `const PeerRow = React.memo(function PeerRow({ r, isSel, isHov, preset, onSelect, onHover }) …)` with `onSelect`/`onHover` `useCallback`-stable in the parent and `isSel = selected === r.figi` / `isHov = hovered === r.figi` computed at the call site so they arrive as **booleans** — a hover/selection transition then re-renders exactly 2 rows, and scatter↔table highlight sync is preserved.
- **Active-node budget:** ceil(400/32)=13 visible + 2×10 overscan = **≤33 rows ≈ ≤1,200 active nodes** (from 5,800); hover transition cost ≈ 2 rows ≈ 70 nodes. DOM `<tr>` count ≤ 35 (33 + 2 spacers) — this is the e2e assertion.

## 4. Verification (implementer runs these; all commands exist today unless marked new)

1. **Bundle gate (Δ1):** `cd caos/frontend && npm run build && node scripts/bundle-secret-scan.mjs` (new) → exit 0. Negative test once: plant `"sk-ant-TEST"` in any client file, confirm the scan fails, revert.
2. **Unit:** `npm run test` — update `src/lib/evidence-sync.test.tsx` to the S1 hooks (`useEvidenceSynced`/`useSetActiveEvidence`); `useVirtualScroll.test.ts` unchanged.
3. **E2E (Playwright, existing auth via globalSetup/storageState — do not add per-test logins, the auth route throttles):** sector-rv spec asserts peer-table `tbody tr` count ≤ 35 with the 166-row IT sector selected; command spec already covers the virtualized tables.
4. **A11y:** `node caos/frontend/scripts/a11y-axe.mjs` — spacer rows are `aria-hidden`, table semantics intact; issuers register untouched.
5. **Render-waterfall spot-check (React DevTools Profiler, manual):** deepdive — hover an E-xx chip → exactly 2 EvChip commits (was 17+); any route — open/close issuer-profile overlay → only the overlay subtree commits; tab blur/refocus → no app-wide commit wave (S3).
6. **Server suite** (Δ2 touches FastAPI): `caos/server/.venv/bin/python -m pytest` per repo convention (or `.venv311`).

## 5. Acceptance checklist

- [ ] CI runs the bundle secret scan after every frontend build; scan green on a fresh build (no key values, no `postgres://`, no `CAOS_DISABLE_LOGIN`, no external AI hosts in `out/`)
- [ ] Every LLM/vector route in §1.1 carries `Depends(get_identity)` (already true — re-assert after Δ2 diffs) and `POST /api/query/answer` + `GET /api/autonomy/draft` expose pinned `response_model`s
- [ ] EvChip hover = 2 component commits; overlay open/close does not re-render action-only consumers; tab refocus does not re-render Auth consumers when the user is unchanged
- [ ] sector-rv peer table holds ≤35 `<tr>` at any scroll position; command tables stay at their existing windows; issuers register keeps `content-visibility` windowing
- [ ] `npm run test`, a11y-axe, Playwright sector-rv assertion, and server pytest all green

## 6. Per-route verification record (provenance)

Every core route was independently verified by a fresh-context subagent against two questions: (a) does the proposal leave any AI or database token reachable from the browser bundle, and (b) does any performance optimization re-expose a server-side secret. **18/18 PASS** across /command, /sector-rv, /pipeline, /deepdive, /model, /reports, /monitor, /query, /issuers(+profile). Each verdict rests on that verifier's own greps of the built chunks (`out/_next/static/chunks/app/<route>/page-*.js`, plus full-tree scans on sector-rv/command/query/monitor) and reads of the route source and its FastAPI endpoints — not on the authoring analysis. Three verifier findings changed this document: the Δ1 two-pass scan design, the `/api/autonomy/draft` no-frontend-caller annotation, and the `AnswerResponse` cache-envelope fields.

Standing caveat the implementer must discharge: the scanned `out/` build predates the newest src by ~1 day. The claim "bundle is clean" is proven for that artifact and for current source statically; it becomes proven for the shipped artifact the first time Δ1's scan runs green on a fresh `next build`. That scan is the gate — run it before calling objective 1 done.
