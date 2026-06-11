-- CAOS PostgreSQL Initialization
-- Enables pgvector for local RAG dev (replaces Pinecone in dev environment)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- pgvector for local dev

-- ─── Issuer Registry ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issuers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    ticker          TEXT,
    industry        TEXT,
    country         TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Documents (MinIO metadata) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issuer_id       UUID REFERENCES issuers(id) ON DELETE CASCADE,
    doc_type        TEXT NOT NULL,  -- 'OM' | 'CreditAgreement' | 'LBOModel' | 'InterimReport' | 'PricingSheet'
    file_name       TEXT NOT NULL,
    minio_key       TEXT NOT NULL UNIQUE,
    content_hash    TEXT,           -- SHA-256 for dedup
    mnpi_flag       BOOLEAN DEFAULT FALSE,
    uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
    fiscal_period   TEXT            -- e.g. 'Q1-2026' for delta runs
);

-- ─── Capital Structure (time-series, append-only) ─────────────────────────
CREATE TABLE IF NOT EXISTS capital_structure_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issuer_id       UUID REFERENCES issuers(id) ON DELETE CASCADE,
    fiscal_period   TEXT NOT NULL,
    snapshot_date   DATE NOT NULL,
    data            JSONB NOT NULL,  -- Full CP-1 Pydantic output
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Financials (time-series, append-only) ────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issuer_id       UUID REFERENCES issuers(id) ON DELETE CASCADE,
    fiscal_period   TEXT NOT NULL,
    period_end_date DATE NOT NULL,
    revenue         NUMERIC(20, 2),
    ebitda          NUMERIC(20, 2),
    ebitda_margin   NUMERIC(6, 4),
    net_leverage    NUMERIC(6, 2),
    interest_coverage NUMERIC(6, 2),
    fcf             NUMERIC(20, 2),
    data            JSONB,           -- Full CP-2 Pydantic output
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Market Data (pricing runs) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_data_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issuer_id       UUID REFERENCES issuers(id) ON DELETE CASCADE,
    run_date        DATE NOT NULL,
    instrument      TEXT,           -- bond CUSIP or loan identifier
    spread_bps      NUMERIC(8, 2),
    ytw_pct         NUMERIC(8, 4),
    dm_bps          NUMERIC(8, 2),
    source_file     TEXT,           -- MinIO key of pricing sheet
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Covenant Headroom ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS covenant_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issuer_id       UUID REFERENCES issuers(id) ON DELETE CASCADE,
    fiscal_period   TEXT NOT NULL,
    covenant_name   TEXT NOT NULL,
    limit_value     NUMERIC(10, 4),
    actual_value    NUMERIC(10, 4),
    headroom_pct    NUMERIC(6, 4),
    severity        TEXT,           -- 'OK' | 'WARNING' | 'CRITICAL'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DAG Run Audit Log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dag_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issuer_id       UUID REFERENCES issuers(id),
    run_type        TEXT NOT NULL,  -- 'FULL_RUN' | 'DELTA_RUN'
    status          TEXT NOT NULL DEFAULT 'PENDING',  -- 'PENDING' | 'RUNNING' | 'COMPLETED' | 'BLOCKED' | 'FAILED'
    trigger_doc_id  UUID REFERENCES documents(id),
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    agent_outputs   JSONB           -- Aggregated CP-X outputs
);

-- ─── Agent Module Outputs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_outputs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dag_run_id      UUID REFERENCES dag_runs(id) ON DELETE CASCADE,
    module_id       TEXT NOT NULL,  -- 'CP-0' | 'CP-1' | etc.
    status          TEXT NOT NULL DEFAULT 'PENDING',
    severity        TEXT,           -- CP-5 verdict: 'PASS' | 'WARNING' | 'CRITICAL'
    output          JSONB,
    evidence_chain  JSONB,          -- CP-5B lineage: [{evidence, mechanic, implication}]
    blocked_reason  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Vector Embeddings (dev / pgvector) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS document_chunks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_type      TEXT NOT NULL,  -- 'PARENT' | 'CHILD'
    parent_id       UUID REFERENCES document_chunks(id),
    chunk_index     INT,
    content         TEXT NOT NULL,
    embedding       vector(384),    -- all-MiniLM-L6-v2 (384-dim); adjust for prod model
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Users (Auth) ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'analyst',  -- 'analyst' | 'admin'
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_issuers_name ON issuers(name);
CREATE INDEX IF NOT EXISTS idx_documents_issuer ON documents(issuer_id);
CREATE INDEX IF NOT EXISTS idx_fin_snapshots_issuer_period ON financial_snapshots(issuer_id, fiscal_period);
CREATE INDEX IF NOT EXISTS idx_dag_runs_issuer ON dag_runs(issuer_id);
CREATE INDEX IF NOT EXISTS idx_agent_outputs_dag ON agent_outputs(dag_run_id, module_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
