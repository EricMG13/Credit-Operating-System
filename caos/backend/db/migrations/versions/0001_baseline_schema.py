"""baseline schema (ported from infra/postgres/init.sql)

Revision ID: 0001_baseline
Revises:
Create Date: 2026-06-09

This is the production-deploy equivalent of the docker-entrypoint init.sql.
Keep the two in sync: any DDL change must be added BOTH as a new Alembic
revision AND mirrored into infra/postgres/init.sql so docker-compose dev
spins up identically.
"""
from alembic import op

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')

    op.execute("""
        CREATE TABLE IF NOT EXISTS issuers (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name            TEXT NOT NULL,
            ticker          TEXT,
            industry        TEXT,
            country         TEXT,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            issuer_id       UUID REFERENCES issuers(id) ON DELETE CASCADE,
            doc_type        TEXT NOT NULL,
            file_name       TEXT NOT NULL,
            minio_key       TEXT NOT NULL UNIQUE,
            content_hash    TEXT,
            mnpi_flag       BOOLEAN DEFAULT FALSE,
            uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
            fiscal_period   TEXT
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS capital_structure_snapshots (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            issuer_id       UUID REFERENCES issuers(id) ON DELETE CASCADE,
            fiscal_period   TEXT NOT NULL,
            snapshot_date   DATE NOT NULL,
            data            JSONB NOT NULL,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS financial_snapshots (
            id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            issuer_id         UUID REFERENCES issuers(id) ON DELETE CASCADE,
            fiscal_period     TEXT NOT NULL,
            period_end_date   DATE NOT NULL,
            revenue           NUMERIC(20, 2),
            ebitda            NUMERIC(20, 2),
            ebitda_margin     NUMERIC(6, 4),
            net_leverage      NUMERIC(6, 2),
            interest_coverage NUMERIC(6, 2),
            fcf               NUMERIC(20, 2),
            data              JSONB,
            created_at        TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS market_data_runs (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            issuer_id       UUID REFERENCES issuers(id) ON DELETE CASCADE,
            run_date        DATE NOT NULL,
            instrument      TEXT,
            spread_bps      NUMERIC(8, 2),
            ytw_pct         NUMERIC(8, 4),
            dm_bps          NUMERIC(8, 2),
            source_file     TEXT,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS covenant_snapshots (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            issuer_id       UUID REFERENCES issuers(id) ON DELETE CASCADE,
            fiscal_period   TEXT NOT NULL,
            covenant_name   TEXT NOT NULL,
            limit_value     NUMERIC(10, 4),
            actual_value    NUMERIC(10, 4),
            headroom_pct    NUMERIC(6, 4),
            severity        TEXT,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS dag_runs (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            issuer_id       UUID REFERENCES issuers(id),
            run_type        TEXT NOT NULL,
            status          TEXT NOT NULL DEFAULT 'PENDING',
            trigger_doc_id  UUID REFERENCES documents(id),
            started_at      TIMESTAMPTZ DEFAULT NOW(),
            completed_at    TIMESTAMPTZ,
            agent_outputs   JSONB
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_outputs (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            dag_run_id      UUID REFERENCES dag_runs(id) ON DELETE CASCADE,
            module_id       TEXT NOT NULL,
            status          TEXT NOT NULL DEFAULT 'PENDING',
            severity        TEXT,
            output          JSONB,
            evidence_chain  JSONB,
            blocked_reason  TEXT,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS document_chunks (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            document_id     UUID REFERENCES documents(id) ON DELETE CASCADE,
            chunk_type      TEXT NOT NULL,
            parent_id       UUID REFERENCES document_chunks(id),
            chunk_index     INT,
            content         TEXT NOT NULL,
            embedding       vector(384),
            metadata        JSONB,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email           TEXT NOT NULL UNIQUE,
            hashed_password TEXT NOT NULL,
            full_name       TEXT NOT NULL,
            role            TEXT NOT NULL DEFAULT 'analyst',
            is_active       BOOLEAN DEFAULT TRUE,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_issuers_name ON issuers(name)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_documents_issuer ON documents(issuer_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_fin_snapshots_issuer_period "
        "ON financial_snapshots(issuer_id, fiscal_period)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_dag_runs_issuer ON dag_runs(issuer_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_agent_outputs_dag "
        "ON agent_outputs(dag_run_id, module_id)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_chunks_embedding "
        "ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")


def downgrade() -> None:
    # Baseline is non-reversible: dropping the schema deletes all data.
    raise RuntimeError("Baseline migration cannot be downgraded.")
