fix all# Performance Review Matrix

Verified-findings audit across the CAOS FastAPI server routes and analytical engine. Each audited item was reviewed against the performance lenses and live code; findings below survived adversarial verification.

## 1. Audit status

| Item | Status | Verified findings |
|------|--------|-------------------|
| nlquery.py | AUDITED | 0 |
| retrieval.py | AUDITED | 0 |
| vault_export.py | AUDITED | 1 |
| querygraph.py | AUDITED | 0 |
| queryoverlay.py | AUDITED | 0 |
| readiness.py | AUDITED | 0 |
| textscan.py | AUDITED | 0 |
| routes/query.py | AUDITED | 0 |
| routes/ingestion.py | AUDITED | 0 |
| routes/runs.py | AUDITED | 0 |
| ingest.py | AUDITED | 0 |
| run_executor.py | AUDITED | 2 |

## 2. Findings (sorted by severity, high first)

| Severity | Item | File:line | Lens | Summary | Failure |
|----------|------|-----------|------|---------|---------|
| high | run_executor.py | caos/server/routes/portfolio.py:76 | every Run/Chunk/Document query has limit caps | Unbounded query on `select(Issuer)` in `/api/portfolio` GET endpoint. | The endpoint `get_portfolio` queries all registered issuers in a single statement without a `.limit()` cap. If the coverage universe grows to thousands of issuers, the endpoint will load the entire table, and then scan/query all matching complete runs for those issuers, leading to memory bloating, high response latency, and database connection timeouts under concurrent load. |
| high | run_executor.py | caos/server/routes/portfolios.py:97 | no per-row N+1 (batch .in_() instead) | Severe N+1 query pattern on positional and constraint data in `/api/portfolios/` GET endpoint. | The `list_portfolios` endpoint performs a sequential walk over all `Portfolio` rows (capped at 200). Inside the loop, it performs two database roundtrips: `_positions(db, prt.id)` and `_constraints(db, prt.id)`. Under load, listing portfolios results in 400 separate SQL queries, stalling the request and depleting the connection pool, which is sized closely to concurrent execution limits. |
| med | vault_export.py | caos/server/vault_export.py:463 | no sync filesystem work or CPU-heavy work on the event loop | Heavy database write and vault scan synchronous execution inside GET `/api/query/capabilities` and `/api/query/graph`. | On every capabilities check or graph walk request, `sync_analyst_memos(db)` is called. If the vault files' modification time changes, the function performs a synchronous scan/read of ALL markdown memo files in the vault (`_read_memo_notes`), parses them for wikilinks, executes `delete(AnalystLink)`, and sequentially inserts all new links. This causes a massive DB write and CPU spike on a read-only GET request. If multiple analysts query simultaneously, the overlapping deletes and inserts race on the database transaction, leading to deadlocks. |
