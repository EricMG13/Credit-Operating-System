# Integration seams and contracts audit

## 1. Objective and stakes

You are a Sonnet 5 audit agent. Re-run this goal-prompt on every pull request (PR). Audit and report only. Do not fix code, stage files, call live SEC EDGAR or large language model (LLM) services, spend tokens, or use the analyst database.

Prove that every cross-system contract still holds. CAOS joins a Next.js frontend, a FastAPI backend, an EDGAR Model Context Protocol (MCP) wrapper, SEC EDGAR, and Anthropic, OpenRouter, and Gemini providers. A visible outage is safer than silent drift: a renamed field, changed nullability, provider error, or unmarked fixture can render a blank, `NaN`, stale value, or false live result in a committee-facing view.

The audit passes only when:

- Every frontend request maps to the intended route, request model, success schema, and error envelope
- Every response field read by a real view exists with compatible type, presence, and nullability
- Every external call has a bounded timeout, deliberate retry policy, and fault-isolated outcome
- Every degraded, demo, mock, or fallback result is deterministic and visibly identified

Use `origin/main` as the base. Discover the current surface each run. Treat inventories and accepted risks below as assertions to re-verify, not permanent facts.

## 2. Scope discovery

Create a hermetic workspace and select the repository interpreter:

```bash
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
BASE=origin/main
OUT=$(mktemp -d /tmp/caos-integration-seams.XXXXXX)
PY="$ROOT/caos/server/.venv/bin/python"
test -x "$PY" || PY="$ROOT/caos/server/.venv311/bin/python"
test -x "$PY"
git rev-parse HEAD "$BASE" | tee "$OUT/revisions.txt"
```

Export the current OpenAPI document without starting the FastAPI lifespan or using live keys:

```bash
(
  cd caos/server
  env ENVIRONMENT=development DATABASE_URL=sqlite+aiosqlite:////tmp/caos-seams.db \
    ANTHROPIC_API_KEY= GEMINI_API_KEY= OPENROUTER_API_KEY= EDGAR_USER_AGENT= \
    "$PY" - <<'PY'
import json
from main import app
print(json.dumps(app.openapi(), sort_keys=True))
PY
) > "$OUT/openapi-head.json"
```

Enumerate mounted endpoints, declared response models, and emitted success schemas:

```bash
(
  cd caos/server
  env ENVIRONMENT=development ANTHROPIC_API_KEY= GEMINI_API_KEY= OPENROUTER_API_KEY= \
    "$PY" - <<'PY'
from fastapi.routing import APIRoute
from main import app
for route in sorted((r for r in app.routes if isinstance(r, APIRoute)), key=lambda r: r.path):
    methods = ",".join(sorted((route.methods or set()) - {"HEAD", "OPTIONS"}))
    print(methods, route.path, route.name, repr(route.response_model), sep="\t")
PY
) > "$OUT/routes-head.tsv"

"$PY" - "$OUT/openapi-head.json" > "$OUT/openapi-contracts-head.tsv" <<'PY'
import json, sys
spec = json.load(open(sys.argv[1]))
for path, item in sorted(spec["paths"].items()):
    for method, operation in sorted(item.items()):
        if method not in {"get", "post", "put", "patch", "delete"}: continue
        for status, response in sorted(operation.get("responses", {}).items()):
            if not str(status).startswith("2"): continue
            schema = response.get("content", {}).get("application/json", {}).get("schema", {})
            print(method.upper(), path, status, operation.get("operationId", ""), json.dumps(schema, sort_keys=True), sep="\t")
PY
```

Enumerate frontend calls, mirror types, data-backed views, and the alleged type-sync lane:

```bash
python3 - "$OUT/fe-calls.tsv" <<'PY'
from pathlib import Path
import re, sys
root = Path("caos/frontend/src")
pat = re.compile(r"\b(?:api|axios)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*([`\"'])(.*?)\2", re.S)
rows = []
for path in root.rglob("*.ts*"):
    if ".test." in path.name or ".spec." in path.name: continue
    text = path.read_text(errors="replace")
    for hit in pat.finditer(text):
        url = hit.group(3)
        if url.startswith("/api/"):
            rows.append((str(path), text[:hit.start()].count("\n") + 1, hit.group(1).upper(), url))
Path(sys.argv[1]).write_text("".join(f"{p}\t{line}\t{verb}\t{url}\n" for p, line, verb, url in sorted(rows)))
PY

rg -n '^(export )?(interface|type) [A-Z]' caos/frontend/src --glob '*.{ts,tsx}' > "$OUT/frontend-types.txt"
rg -l "from [\"']@/lib/|\\b(fetch|api|axios)\\." \
  caos/frontend/src/app caos/frontend/src/components --glob '*.{ts,tsx}' > "$OUT/data-backed-views.txt"
rg -n 'fetch\s*\(|axios\.|httpx\.|urlopen\(|messages\.(create|stream)|generate_content' \
  caos/frontend/src caos/server caos/mcp --glob '*.{ts,tsx,py}' > "$OUT/raw-boundaries.txt"
sed -n '1,160p' caos/frontend/tsconfig.sync.json > "$OUT/tsconfig-sync.txt"
rg -n 'tsconfig\.sync\.json|tsc .*sync|openapi|type.?sync' \
  caos/frontend/package.json caos/frontend/scripts caos/scripts .github 2>/dev/null \
  > "$OUT/type-sync-references.txt" || true
```

`caos/frontend/tsconfig.sync.json` currently declares design-sync aliases for `next/link` and `next/navigation`; it does not generate or verify API types. Re-prove that fact. Do not credit `tsconfig.sync.json` as a contract gate unless the current PR wires it into type generation or continuous integration (CI).

Capture the PR surface:

```bash
git diff --name-status "$BASE" -- \
  caos/server/main.py caos/server/routes caos/server/analysis_contracts.py \
  caos/server/engine/schemas.py caos/server/edgar.py caos/server/llm.py \
  caos/server/engine/llm_client.py caos/server/engine/openrouter.py \
  caos/server/engine/gemini.py caos/server/engine/presets.py \
  caos/frontend/src caos/frontend/tsconfig.sync.json caos/mcp/edgar \
  | tee "$OUT/pr-surface.txt"
```

## 3. Coverage checklist

Hold every contract below for the complete current surface. Weight the PR delta, but do not limit the audit to changed endpoints.

| ID | Contract to hold |
|---|---|
| C1 | **Frontend to backend parity:** each frontend method and normalized path resolves to one mounted FastAPI operation. Path, query, header, and body names satisfy the request model and bounds. Each field a rendered view reads exists in the actual response with a compatible scalar, object, array, enum, date, and numeric shape. FastAPI `detail` strings, validation lists, structured conflicts, empty bodies, downloads, and pagination remain parseable by the caller. |
| C2 | **Schema to TypeScript parity:** Pydantic and OpenAPI define the wire contract. Handwritten types under `caos/frontend/src/types` and `src/lib` mirror every consumed field. TypeScript compilation proves internal consistency only; it cannot prove server parity. A server model change must have a matching mirror and consumer change, or evidence that no frontend path consumes it. New runtime casts must not hide unvalidated data. |
| C3 | **Versioning and optional fields:** `/api` is unversioned, so a breaking request or response change must deploy atomically across both sides. Distinguish absent, `null`, empty, and defaulted values. A Pydantic required-but-nullable field maps to `T | null`, not `field?: T`; an omittable field maps to `field?: T`; a new required request field is breaking. Unknown response fields remain ignorable. |
| C4 | **EDGAR MCP contract:** each `@mcp.tool` name, argument, default, type, route, method, bound, response, identity header, and timeout matches `caos/server/routes/edgar.py`. The wrapper remains a thin CAOS API client. Every transport error, HTTP error, empty body, and non-JSON body becomes an intelligible MCP tool error with no secret leakage. Pointer results remain non-citable until vaulting succeeds. |
| C5 | **SEC EDGAR boundary:** all SEC traffic uses `caos/server/edgar.py`. The configured User-Agent, fair-access throttle, timeout, response-size cap, finite-JSON rejection, redirect host check, and archive URL guard remain enforced. Rate limits, 5xx responses, outages, timeouts, malformed JSON, and partial payloads become `EdgarError`; routes map them deliberately. CP-1 acquisition fails safe to its next declared source instead of aborting a run. |
| C6 | **LLM boundaries:** inventory every raw Anthropic, OpenRouter, and Gemini call, including streaming and advisor exceptions. Each call has a provider key gate, bounded timeout, usage trace, budget accounting, safe response normalization, and lane-level exception boundary. Model selection never sends an identifier to a provider without its key. Retry and cheaper-model fallback stay bounded and same-provider. Keyless mode and total provider failure produce the lane's declared deterministic, unavailable, or `Blocked` result without presenting generated content as live success. |
| C7 | **Retry, timeout, and idempotency:** record the policy at frontend to FastAPI, MCP to FastAPI, FastAPI to SEC, and FastAPI to each LLM provider. Outer timeouts exceed downstream work plus cancellation margin. SDK retries do not stack with application retries. Retry only idempotent reads or writes protected by an idempotency key, uniqueness constraint, duplicate detection, or safe rejection. Repeating a mutating request cannot duplicate documents, runs, reports, votes, or model events. |
| C8 | **Graceful degradation:** a backend, SEC, or provider outage leaves unrelated views and runs usable. Every fallback preserves provenance and freshness. Seeded, fixture, demo, keyword, stale-cache, partial, unavailable, and provider-fallback states are visible in the rendered view and exported output. No dependency failure may substitute mock data under a live label. |

## 4. Procedure and exact commands

Produce a schema delta from the base revision without switching or modifying the working tree:

```bash
mkdir -p "$OUT/base-tree"
git archive "$BASE" caos/server | tar -x -C "$OUT/base-tree"
(
  cd "$OUT/base-tree/caos/server"
  env ENVIRONMENT=development DATABASE_URL=sqlite+aiosqlite:////tmp/caos-seams-base.db \
    ANTHROPIC_API_KEY= GEMINI_API_KEY= OPENROUTER_API_KEY= EDGAR_USER_AGENT= \
    "$PY" - <<'PY'
import json
from main import app
print(json.dumps(app.openapi(), sort_keys=True))
PY
) > "$OUT/openapi-base.json"

jq -S '{paths, schemas: .components.schemas}' "$OUT/openapi-base.json" > "$OUT/contracts-base.json"
jq -S '{paths, schemas: .components.schemas}' "$OUT/openapi-head.json" > "$OUT/contracts-head.json"
diff -u "$OUT/contracts-base.json" "$OUT/contracts-head.json" > "$OUT/openapi.diff" || true
git diff --unified=80 "$BASE" -- caos/frontend/src > "$OUT/frontend.diff"
```

For every OpenAPI hunk, pair the changed operation and schema with its frontend call, declared return type, consuming hook, and rendered field. For a specific operation, inspect the resolved contract and all consumers with:

```bash
ENDPOINT='/api/replace-me'
METHOD='get'
jq --arg p "$ENDPOINT" --arg m "$METHOD" '.paths[$p][$m]' "$OUT/openapi-head.json"
rg -n --fixed-strings "$ENDPOINT" caos/frontend/src
rg -n 'replace_response_type' caos/frontend/src caos/server
```

Treat response-model-less routes as untyped seams. Exercise their real JSON through `TestClient`; do not infer their shape from annotations. Compare every request constraint and every consumed response field, including `required`, `nullable`, unions, enums, collection items, and error bodies.

Run the contract and boundary suites with all provider keys blank. `caos/tests/server/conftest.py` must keep the run offline:

```bash
env ANTHROPIC_API_KEY= GEMINI_API_KEY= OPENROUTER_API_KEY= EDGAR_USER_AGENT= \
  "$PY" -m pytest -q \
  caos/tests/server/test_api.py caos/tests/server/test_edgar.py \
  caos/tests/server/test_edgar_cp1.py caos/tests/server/test_llm_client.py \
  caos/tests/server/test_openrouter.py caos/tests/server/test_gemini.py \
  caos/tests/server/test_presets.py caos/tests/server/test_model_tier_routing.py \
  caos/tests/server/test_budget.py caos/tests/server/test_llm_chat.py \
  caos/tests/server/test_synth_live.py caos/tests/server/test_council.py \
  caos/tests/server/test_debate.py caos/tests/server/test_entailment.py \
  caos/tests/server/test_deepresearch.py caos/tests/server/test_research_report.py \
  caos/tests/server/test_query_answer.py caos/tests/server/test_query_overlay.py \
  caos/tests/server/test_nlquery.py caos/tests/server/test_scenario.py \
  caos/tests/server/test_runner_fault_isolation.py

(cd caos/frontend && npx tsc --noEmit && npx vitest run)

if rg -q 'tsconfig\.sync\.json' caos/frontend/package.json caos/frontend/scripts .github; then
  (cd caos/frontend && npx tsc -p tsconfig.sync.json --noEmit)
fi
```

The test evidence must cover this fault matrix, not merely return green: EDGAR 429, 5xx, timeout, network error, non-JSON, oversized body, and off-host redirect; each LLM provider 429, overload, 5xx, timeout, malformed or empty response, missing key, exhausted fallback, and response-shape drift; MCP 4xx, 5xx, timeout, empty body, and non-JSON body; frontend 401, 404, 409, 422, timeout, and backend-down behavior. If a row lacks durable coverage, create a throwaway hermetic probe, run it, cite its output, and remove it:

```bash
PROBE=caos/tests/server/_integration_seam_probe.py
test ! -e "$PROBE"
env ANTHROPIC_API_KEY= GEMINI_API_KEY= OPENROUTER_API_KEY= EDGAR_USER_AGENT= \
  "$PY" -m pytest -q "$PROBE" -s
rm "$PROBE"
```

Verify MCP parity without calling a live CAOS or SEC service. A missing MCP runtime test is a coverage finding, not proof of behavior:

```bash
"$PY" -m py_compile caos/mcp/edgar/server.py
rg -n '@mcp\.tool|async def edgar_|_api\(' caos/mcp/edgar/server.py
rg -n '@router\.(get|post)|class (FilingHitOut|ExhibitOut|VaultExhibitRequest|VaultExhibitResponse)|Query\(' \
  caos/server/routes/edgar.py
```

For every changed mutation, submit the same valid request twice through a hermetic `TestClient` test. Record whether the second call deduplicates, returns the same resource, or rejects safely. Any silent duplicate or partial second write fails C7.

## 5. Evidence and reporting

Write one report: `caos/docs/qa/reports/integration-seams-YYYY-MM-DD.md`.

Lead with `PASS` or `FAIL` and one sentence. Include:

- Head and `origin/main` commits, files reviewed, endpoint count, response-model-less routes, frontend call count, and unpaired contracts
- One row for C1 through C8 with `PASS`, `FAIL`, or `NOT PROVEN`, plus `file:symbol`, command, and test evidence
- Findings ordered `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, each with the broken contract, exact producer and consumer, real failure mode, and smallest repair direction
- An appendix containing the commands run, exit codes, relevant output, skipped checks, and accepted-risk re-verification

`FAIL` blocks merge for any proven field drift that breaks a real view; orphan frontend call; new untyped route without a contract test; missing timeout; unsafe retry of a mutation; provider call without key, budget, or fault isolation; MCP contract mismatch; dependency fault that aborts unrelated work; or unmarked demo, fixture, stale, or fallback data. `NOT PROVEN` blocks merge when the missing evidence covers a changed seam or a `CRITICAL` or `HIGH` failure mode.

Adversarial verification is mandatory before reporting drift. Trace the server producer to the frontend field read and rendered component. Then inject the suspected old, new, missing, `null`, malformed, or error payload through an existing test or throwaway mock. Show the actual blank, `NaN`, crash, stale value, incorrect action, or false live label. A schema difference with no consuming view is informational. An extra server field is not drift. Do not claim a view breaks from type comparison alone.

## 6. Accepted-risk register

These demo and mock seams are accepted only while their guard conditions hold. Re-verify them every run. If a guard fails, report it under C8. Add an entry only with explicit owner approval and a testable guard.

| ID | Accepted seam | Guard conditions |
|---|---|---|
| AR-1 | Frontend hooks may fall back to seeded portfolio, run, model, or pipeline data when the backend is unavailable. | The view labels demo or fallback state, preserves the error or phase signal, excludes fixture values from live export, and never resolves a failed live request as live success. |
| AR-2 | Monitor and selected workflow previews may use client-side simulation where no production backend exists. | The surface is marked simulated, cannot mutate live records, and does not share a live-data label or freshness indicator. |
| AR-3 | Keyless LLM lanes may return deterministic chat, research, synthesis, routing, or unavailable fixtures. | No provider call occurs, output is deterministic, provenance says demo or unavailable, and committee-ready status cannot be inferred from the fixture. |
| AR-4 | EDGAR-backed CP-1 acquisition may fall through to reported disclosures or a declared fixture when SEC EDGAR is unavailable. | Source precedence remains explicit, the result carries its actual source and freshness, and a fixture cannot masquerade as retrieved SEC data. |
