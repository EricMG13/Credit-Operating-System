"""CAOS server configuration.

One process, environment-driven. Local dev runs with the defaults (SQLite +
./data storage + demo seed). The production deploy (deploy/docker-compose.yml)
overrides via the environment:

  DATABASE_URL        Postgres SQLAlchemy URL (postgresql+asyncpg://...); the
                      default is a local SQLite file.
  CAOS_STORAGE_DIR    Document-vault root; the compose stack mounts a durable
                      volume at /vault. Default is ./data/vault.
  ANTHROPIC_API_KEY   Chat/synthesis key; LLM lanes fall back to deterministic
                      fixtures when unset.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVER_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"

    # SQLAlchemy async URL. Default: local SQLite file next to the server.
    # In production point this at Postgres: postgresql+asyncpg://...
    database_url: str = f"sqlite+aiosqlite:///{SERVER_DIR / 'data' / 'caos.db'}"

    # Document vault root. In production mount a durable volume (compose: /vault).
    caos_storage_dir: str = str(SERVER_DIR / "data" / "vault")

    # Built frontend (Next.js static export). Served at "/".
    caos_static_dir: str = str(SERVER_DIR / "static")

    # Seed the three demo issuers on first boot. Safe-by-default OFF: a prod boot
    # with the override dropped starts empty rather than shipping demo issuers.
    # Dev turns it on via caos/.env.example (CAOS_DEMO_SEED=true). main.py also
    # hard-refuses demo seeding in production (fail-closed). (#34)
    caos_demo_seed: bool = False

    # Defense-in-depth for the forwarded-identity trust (identity.py / SECURITY.md
    # §1). Caller identity comes from the edge proxy's X-Forwarded-* headers, which
    # are only trustworthy because the proxy is the sole network path to the app.
    # When this is set, the proxy injects it on every request and the app rejects
    # any deployed-context request whose X-Edge-Authorization does not match —
    # turning "sole ingress" from an operational assumption into an enforced check,
    # so a directly-reachable app port can't be hit with forged identity headers.
    # Empty = enforcement off (a loud startup warning fires in production). Env:
    # EDGE_PROXY_SECRET. Generate with e.g. `python -c "import secrets;print(secrets.token_urlsafe(32))"`.
    edge_proxy_secret: str = ""

    # In-app analyst login (routes/auth.py). A single shared access code gates
    # self-registration of named analyst profiles; the profile id is signed into
    # the caos_analyst cookie (session_secret) and stamped on every run. Env:
    # ANALYST_SIGNUP_CODE, SESSION_SECRET. Both defaults are dev-only — set real
    # values in production (startup fails closed otherwise).
    analyst_signup_code: str = "131113"
    session_secret: str = "dev-insecure-session-secret"

    # Anthropic — optional; chat degrades to demo replies without it.
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-8"

    # Gemini provider (engine/gemini.py). Set GEMINI_API_KEY to activate the hybrid
    # (cheap/fast/strong lanes on Gemini); empty = those tiers fall back to their
    # Anthropic equivalents (engine/presets.py), so the engine runs unchanged without
    # it. NOTE: live lanes still gate on ANTHROPIC_API_KEY (it drives the MAX/top tier
    # and the live-vs-fixture synth gate), so the hybrid needs BOTH keys —
    # GEMINI_API_KEY alone leaves the engine on fixtures/demo. google-genai is imported
    # only when a gemini-* model is actually selected.
    gemini_api_key: str = ""

    # Model-mode tiers (engine/presets.py). Four tiers the TEST/LITE/BALANCED/MAX
    # table maps lanes onto, trading token cost ↔ latency ↔ reasoning quality.
    # Defaults wire the agreed hybrid — cheap/fast/strong on Gemini, top on Claude
    # Opus (so BALANCED heavy = Gemini 2.5 Pro, MAX heavy = Opus) — but the Gemini
    # tiers only take effect when GEMINI_API_KEY is set; otherwise presets
    # substitutes the Anthropic equivalent. Env-overridable.
    model_tier_cheap: str = "gemini-2.5-flash-lite"  # TEST all; LITE/BALANCED light; LITE extract
    model_tier_fast: str = "gemini-2.5-flash"        # LITE heavy; BALANCED/MAX light; MAX extract
    model_tier_strong: str = "gemini-2.5-pro"        # BALANCED heavy
    model_tier_top: str = "claude-opus-4-8"          # MAX heavy

    # CP-5C semantic committee review (engine/council.py). An ensemble of
    # adversarial reviewer "seats" that emit CP-5 findings the deterministic
    # gate then consumes — it never decides status itself. Off by default: it
    # is an LLM fan-out (one call per seat per run) and so costs tokens, and it
    # needs anthropic_api_key. When unset the runner uses the no-op
    # FixtureReviewer, so the engine stays fully exercisable offline.
    council_enabled: bool = False
    council_seats: int = 4  # number of reviewer lanes used (1-4)
    # Stage-2 anonymized peer round: after the seats raise findings, show the
    # pooled findings back to the panel with authorship stripped and let them
    # confirm/reject and recalibrate severity. Trims single-seat false positives
    # at the cost of a second LLM fan-out. No effect unless council_enabled.
    council_peer_round: bool = False

    # CP-6A/6E adversarial debate (engine/debate.py). The structured debate and
    # its verdict are always computed deterministically from upstream outputs;
    # this flag only enables the LiveDebater, which authors each advocate's
    # *narrative* via an LLM (one call per side). Off by default (costs tokens,
    # needs anthropic_api_key); when unset the deterministic prose is used.
    debate_enabled: bool = False

    # CP synthesizer advisor tool (engine/synth.py). Beta (advisor-tool-2026-03-01).
    # When on, the live synthesizer's reasoning-heavy call runs on a cheaper executor
    # (synth_executor_model) and consults a stronger advisor model (advisor_model)
    # mid-generation via client.beta.messages — close to advisor-solo quality at
    # executor rates. Off by default: it is a beta API and changes the cost profile.
    # When off, synth uses anthropic_model on the plain Messages API (unchanged).
    advisor_enabled: bool = False
    synth_executor_model: str = "claude-sonnet-4-6"
    advisor_model: str = "claude-opus-4-8"

    # Upload cap (MB).
    max_upload_mb: int = 250

    # Optional: ClamAV malware scan for uploads (avscan.py / SECURITY.md §4).
    # Empty host = disabled (no-op). When set, every user upload is streamed to
    # clamd (INSTREAM) before parsing/vaulting; a signature hit is rejected (422)
    # and a configured-but-unreachable scanner fails CLOSED (503). The deploy
    # stack ships a clamav sidecar under the "av" compose profile:
    #   docker compose --profile av up -d   (then set CLAMAV_HOST=clamav)
    # Size clamd's StreamMaxLength >= max_upload_mb or large files scan-fail.
    clamav_host: str = ""
    clamav_port: int = 3310
    clamav_timeout_s: int = 30

    # Within a run, independent analytical modules (same CP-X dependency layer)
    # synthesize concurrently — the LLM-backed ones (CP-1A, CP-4C, …) then run in
    # parallel instead of summing their latencies. This caps how many synth calls
    # are in flight at once per run, so a wide layer can't burst past Anthropic
    # rate limits. Peak concurrent API calls ≈ caos_run_concurrency × this.
    synth_concurrency: int = 4

    # Async run executor.
    caos_run_concurrency: int = 2        # max runs executing at once (Postgres worker)
    # Max durable Deep Research jobs running at once (research_executor.py). POST
    # returns immediately and fires a background task, so without a ceiling a
    # sustained submission rate would accumulate unbounded multi-minute web-search
    # runs; jobs past the cap queue on a semaphore rather than fan out.
    caos_research_concurrency: int = 2
    caos_run_lease_seconds: int = 600    # claim lease; longer than any plausible run
    caos_run_max_attempts: int = 3       # re-claims before an orphan is reaped to failed
    caos_run_poll_seconds: float = 1.0   # worker loop tick

    # Optional: external markitdown CLI for structure-preserving document → text
    # extraction (tables, headings — better for financials/covenants than the
    # built-in pypdf/openpyxl). markitdown needs Python 3.10+, so it runs
    # out-of-process: set this to a command that invokes it in a 3.10+ env, e.g.
    # "/opt/markitdown/.venv/bin/markitdown". Empty = use the built-in
    # extractors. See caos/docs/TOOLING_REVIEW.md.
    markitdown_cmd: str = ""
    markitdown_timeout_s: int = 60

    # Optional: SEC EDGAR free filing-retrieval lane — covenant/legal source
    # acquisition for CP-4 (credit agreements = Ex-10.x, indentures = Ex-4.x,
    # covenant "Description of Notes" = S-4/424B). Off by default. SEC fair-access
    # REQUIRES a descriptive User-Agent carrying contact info, e.g.
    # "Atlas Credit research@atlas.example"; requests without one are 403-ed, so
    # the /api/edgar routes return 503 until this is set. No key, no cost. See
    # caos/docs/AGENT_SKILLS_REVIEW.md and
    # "Modular OS/CP-4/REF_CP-4_EDGARCovenantSourceMap.md".
    edgar_user_agent: str = ""
    edgar_timeout_s: int = 30
    edgar_max_exhibit_mb: int = 25

    # Optional: one-way Markdown export of finished runs into an Obsidian-style
    # vault (vault_export.py). Empty = disabled (no files written, route 503s).
    # When set to a directory, the manual "Export to vault" route writes there on
    # demand; if vault_export_auto is on, a run that finishes Committee Ready is
    # also exported automatically (export failures never fail the run). Derived,
    # write-only mirror — CAOS stays canonical. No new deps, no vector DB. See
    # caos/docs/OBSIDIAN_DATABANK.md.
    vault_export_dir: str = ""
    vault_export_auto: bool = False

    # Per-run LLM token budget (engine/budget.py). 0 = unlimited. When set, a run
    # that spends its budget degrades later LLM modules to their deterministic
    # path (or gates them) instead of spending beyond the cap. 120k is a runaway
    # guard sized above a normal multi-module run (synth ~8k out + several modules
    # + their inputs), not a tight cap — only the heaviest tail runs feel it. Tune
    # off the per-call "output_tokens=…" logs in engine/synth.py; lower to squeeze
    # cost (at some quality risk on the heaviest deals), 0 to disable.
    run_token_budget: int = 120000


@lru_cache
def get_settings() -> Settings:
    return Settings()
