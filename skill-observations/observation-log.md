# Skill Observation Log

Running log of skill-improvement observations. Each entry is tagged to a skill
and carries a status of **OPEN** (not yet integrated into the skill file) or
**CLOSED** (integrated / no longer applicable). When loading a skill, scan this
log for OPEN entries tagged to it and apply their insight to the current work,
even before the skill file itself is updated.

Format:

```
## <ISO date> — <skill-name> — [OPEN|CLOSED]
<observation and the change it implies>
```

---

## 2026-07-08 — meta (skills catalog) — CLOSED

Skills audit applied (see `.agent-reviews/skills-audit.md`). `.agents/skills/`
trimmed from 53 → 28: removed two byte-identical `gitnexus-*` copies, five
vendored skills targeting stacks CAOS does not have (Kotlin/Spring, .NET/Rider,
Compose Desktop, Go/skillshare) plus the unused OpenRouter SDK skill, the 15
one-verb design skills subsumed by the `impeccable` umbrella (+ the one-time
`teach-impeccable`), and the regex-based `a11y-audit` (superseded by the
mandated axe-core runner). Retained the security / code-review / duplicate-detection
clusters pending a routing decision — see the audit report §5.

## 2026-07-10 — commit — OPEN

Hard rule 3 hardcodes the trailer `Co-Authored-By: Claude Opus 4.8`, but the
harness now mandates the current model's trailer (`Claude Fable 5` this
session). Stale constant misattributes authorship whenever the model changes.
Change the rule to "trailer names the current model, per the harness git
guidance" instead of a pinned model string.

## 2026-07-13 — playwright-pro — OPEN

Browser fixture guidance should require an explicit no-fallthrough check for
local API interception. Playwright glob patterns that cover a query-string form
can miss the same Axios request when it has no query delimiter, silently reading
a developer's live database and making acceptance runs non-deterministic. Define
both exact and filtered request shapes (or use a URL predicate), then assert the
fixture identity/source before treating route behavior as verified.

## 2026-07-15 — code-reviewer — OPEN

The bundled whole-tree quality scanner recursively traverses in-repo virtual
environments and generated outputs: its CAOS server pass analyzed 11,286 files
until `.venv` and `.venv311` were filtered manually, producing misleading
language totals and findings. Add configurable exclude paths with safe defaults
for virtualenvs, dependency trees, build artifacts, caches, and generated files;
also label the PR analyzer explicitly as diff-only so it is not mistaken for
whole-codebase coverage.

## 2026-07-15 — turbopack — OPEN

The Next.js 16.2 guidance contains two stale diagnostics/fallback details. The
supported webpack opt-out is the `--webpack` flag on `next dev` / `next build`,
not a `bundler: "webpack"` `NextConfig` key. With
`NEXT_TURBOPACK_TRACING=1`, current Next writes the dev trace to
`.next/dev/trace-turbopack`, not a root `trace.json`. Update both examples and
prefer the documented `next experimental-analyze --output` CLI for reusable
bundle-analysis artifacts.

## 2026-07-16 — outstanding — CLOSED

The prescribed server command targets `caos/server`, which contains application
code but no pytest files and therefore exits 5 after collecting zero tests. It
also selects the Python 3.9 `.venv`, which cannot collect the current Python
3.10+ syntax and FastAPI dependency set. The server suite now lives under
`caos/tests/server`; update the command to `env -u ANTHROPIC_API_KEY
caos/server/.venv311/bin/python -m pytest caos/tests/server` and refresh the
obsolete ~317-pass baseline.

Integrated into `.agents/skills/outstanding/SKILL.md` on 2026-07-16: the skill
now targets `.venv311`, the real `caos/tests/server` suite, and the current
355-story tracker / ~1910-pass baseline.

## 2026-07-16 — gitnexus-exploring — OPEN

A local `node .gitnexus/run.cjs analyze` followed by an explicit
`--repair-fts` reported success, but the active MCP `query` endpoint still
returned an empty result with “FTS indexes are missing.” Add troubleshooting
for a stale MCP/server-side index handle (including restart/cache/branch-index
checks) after repair succeeds; the current guidance stops at reindexing and can
leave semantic exploration silently unavailable even while symbol
context/impact continues to work.
