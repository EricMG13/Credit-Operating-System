"""One-way Markdown export of a finished run into an Obsidian-style vault.

A derived, write-only mirror of a run — CAOS stays canonical, the vault is an
output target like the committee report (engine/report.py). The render functions
are pure (dict -> str) so they unit-test without a database; the route in
routes/runs.py loads the ORM rows and hands plain dicts in here.

Layout (a note's *basename* is what Obsidian ``[[wikilinks]]`` resolve against, so
the link text and the filename are kept identical via ``_title``):

    {vault}/Issuers/{Issuer}.md        hub   — YAML frontmatter + links to its runs
    {vault}/Runs/{Issuer - tag}.md     spoke — one finished run, sectioned by module
    {vault}/Analyst-Memos/{Title}.md   memo  — analyst-uploaded commentary
                                       (routes/ingestion.py), auto-wikilinked to
                                       covered issuers; read back by
                                       ``sync_analyst_memos``

No vector DB, no new deps. An analyst who wants in-vault RAG points a local
Obsidian plugin (e.g. Smart Connections) at the folder; CAOS keeps its own
BM25/evidence stack untouched. See caos/docs/OBSIDIAN_DATABANK.md.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, List, Optional, Sequence, Tuple

# Strip only what breaks a filesystem name or an Obsidian wikilink; keep spaces
# so the human title doubles as both the filename and the [[link]] target.
_ILLEGAL = '\\/:*?"<>|#^[]'


def _title(s: str) -> str:
    out = "".join("-" if c in _ILLEGAL else c for c in s).strip()
    return out or "untitled"


def _yaml_block(fields: dict[str, Any]) -> str:
    """Minimal YAML frontmatter — flat scalar values only. A JSON-encoded string
    is also a valid YAML double-quoted scalar, so json.dumps handles escaping."""
    lines = ["---"]
    for k, v in fields.items():
        if v is None or v == "":
            continue
        lines.append(f"{k}: {json.dumps(v, ensure_ascii=False)}")
    lines.append("---")
    return "\n".join(lines)


# Keys whose values may carry raw extracted source text (vs. the module's own
# analysis). Redacted before a value reaches the vault, so a module that ever
# echoes a document chunk / transcript into its output can't leak it into a file
# that might sync off-machine. Substring, case-insensitive — kept specific to
# avoid eating legitimate analytical keys (no bare "text"/"raw").
_RAW_CONTENT_MARKERS = (
    "raw_text", "source_text", "chunk_text", "full_text", "excerpt",
    "snippet", "transcript", "verbatim", "ocr",
)
_REDACTED = "[redacted: raw source text kept out of the vault]"


def _is_raw_key(key: str) -> bool:
    kl = key.lower()
    return any(m in kl for m in _RAW_CONTENT_MARKERS)


def _redact(obj: Any) -> Any:
    """Recursively blank values under raw-content keys; leave everything else."""
    if isinstance(obj, dict):
        return {k: (_REDACTED if _is_raw_key(k) else _redact(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_redact(x) for x in obj]
    return obj


def _output_md(output: dict[str, Any]) -> str:
    """Render a module's *full* runtime_output — nothing truncated, so the agent's
    analysis is captured whole for retrieval (the vault is a corpus, not a
    preview). Scalars inline; long/multiline prose on its own lines; nested
    structures as a fenced JSON block. Raw-source-text keys are redacted first."""
    out: List[str] = []
    for k, v in _redact(output or {}).items():
        if isinstance(v, (dict, list)):
            out.append(f"- **{k}:**\n\n```json\n{json.dumps(v, ensure_ascii=False, indent=2)}\n```")
        else:
            s = str(v)
            if "\n" in s or len(s) > 120:  # agent narrative — keep readable, keep whole
                out.append(f"- **{k}:**\n\n{s}\n")
            else:
                out.append(f"- **{k}:** {s}")
    return "\n".join(out) if out else "_No structured output._"


def spoke_title(issuer_name: str, run: dict) -> str:
    # Always carry the run id (short) so two runs with the same as_of_date can't
    # collide to one filename and silently overwrite each other; keep as_of_date
    # in the name when present for human readability. Same run id -> same file is
    # intentional (re-export is idempotent).
    rid = str(run.get("id", ""))[:8] or "run"
    base = run.get("as_of_date")
    return _title(f"{issuer_name} - {base} - {rid}" if base else f"{issuer_name} - {rid}")


def hub_title(issuer_name: str) -> str:
    return _title(issuer_name)


def render_run_spoke(
    issuer: dict, run: dict, sections: Sequence[dict], findings: Sequence[dict] = ()
) -> str:
    """One finished run as a sectioned note. Each module (agent) is a ``##`` header
    (the natural split point a Markdown-header chunker keys on) carrying its full
    output; each claim trails its evidence ids as citation pills. The CP-5 gate's
    findings are stored as their own section."""
    body = [
        _yaml_block({
            "type": "credit-run",
            "issuer": issuer["name"],
            "ticker": issuer.get("ticker"),
            "industry": issuer.get("industry"),
            "country": issuer.get("country"),
            "as_of": run.get("as_of_date"),
            "qa_status": run.get("qa_status"),
            "committee_status": run.get("committee_status"),
            "run_id": run.get("id"),
        }),
        f"# {issuer['name']} — credit run {run.get('as_of_date') or ''}".rstrip(),
        f"Issuer: [[{hub_title(issuer['name'])}]] · "
        f"QA: {run.get('qa_status', '?')} · Committee: {run.get('committee_status', '?')}",
    ]
    for s in sections:
        body.append(f"\n## {s['module_name']} ({s['module_id']})")
        body.append(f"_Confidence: {s.get('confidence', '?')} · QA: {s.get('qa_status', '?')}_")
        body.append(_output_md(s.get("summary", {})))
        for c in s.get("claims", []):
            cites = " ".join(f"`[{e['evidence_id']}]`" for e in c.get("evidence", []))
            body.append(f"- {c['claim_text']} {cites}".rstrip())
    if findings:
        body.append("\n## QA findings")
        for f in findings:
            mod = f.get("module_id") or "—"
            body.append(
                f"- **{f.get('severity', '?')}** (lane {f.get('lane', '?')}, {mod}): "
                f"{f.get('description', '')}".rstrip()
            )
            if f.get("required_remediation"):
                body.append(f"  - Remediation: {f['required_remediation']}")
    return "\n".join(body) + "\n"


def render_issuer_hub(
    issuer: dict, issuer_runs: Sequence[dict], related_issuers: Sequence[str] = ()
) -> str:
    """The issuer hub: frontmatter for metadata queries + the links the Graph view
    hangs off. Industry/country links cluster issuers by sector and geography (the
    concentration view); ``related_issuers`` are peer/sponsor edges (the contagion
    view)."""
    lines = [
        _yaml_block({
            "type": "issuer",
            "issuer": issuer["name"],
            "ticker": issuer.get("ticker"),
            "industry": issuer.get("industry"),
            "country": issuer.get("country"),
        }),
        f"# {issuer['name']}",
        "",
    ]
    # Categorical cross-links — every issuer in the same sector/country shares a
    # node, so the Graph view shows concentration at a glance. Data's already on
    # the issuer row, so this is free.
    cats = [
        f"- {label}: [[{_title(val)}]]"
        for label, val in (("Industry", issuer.get("industry")), ("Country", issuer.get("country")))
        if val
    ]
    if cats:
        lines += ["## Classification", *cats, ""]
    # Peer/sponsor edges (contagion graph). Stub: CP-1C persists peer *counts* not
    # names, and CP-2D stores no sponsor name, so names aren't available from
    # stored output yet — wire this once peers.py emits peer issuer ids/names.
    # See caos/docs/OBSIDIAN_DATABANK.md.
    if related_issuers:
        lines += ["## Related issuers", *(f"- [[{_title(r)}]]" for r in related_issuers), ""]
    lines.append("## Runs")
    if not issuer_runs:
        lines.append("_No exported runs yet._")
    for r in sorted(issuer_runs, key=lambda r: r.get("as_of_date") or "", reverse=True):
        lines.append(
            f"- [[{spoke_title(issuer['name'], r)}]] — "
            f"{r.get('committee_status', '?')} ({r.get('qa_status', '?')})"
        )
    return "\n".join(lines) + "\n"


def write_run_to_vault(
    vault_dir: str | Path,
    issuer: dict,
    run: dict,
    sections: Sequence[dict],
    issuer_runs: Sequence[dict],
    findings: Sequence[dict] = (),
    related_issuers: Sequence[str] = (),
) -> List[Path]:
    """Write the run spoke and refresh the issuer hub. One-way; overwrites in
    place (the run is the source of truth, the vault is derived)."""
    vault = Path(vault_dir)
    runs_dir = vault / "Runs"
    issuers_dir = vault / "Issuers"
    runs_dir.mkdir(parents=True, exist_ok=True)
    issuers_dir.mkdir(parents=True, exist_ok=True)

    spoke = runs_dir / f"{spoke_title(issuer['name'], run)}.md"
    hub = issuers_dir / f"{hub_title(issuer['name'])}.md"
    spoke.write_text(render_run_spoke(issuer, run, sections, findings), encoding="utf-8")
    hub.write_text(render_issuer_hub(issuer, issuer_runs, related_issuers), encoding="utf-8")
    return [spoke, hub]


async def export_run(session, run_id: str, vault_dir: str | Path) -> List[Path]:
    """DB-aware orchestrator: load a run, its issuer and content modules, and
    write the vault notes. Shared by the manual route and the auto-on-finish hook
    so the gathering logic lives once. Imports are local so the pure renderers
    above (and the self-check) stay importable without a database.
    """
    from sqlalchemy import select  # local: keep module import DB-free for the renderers

    from database import Claim, EvidenceItem, Issuer, ModuleOutput, QAFinding, Run
    from engine.report import _NON_CONTENT

    run = await session.get(Run, run_id)
    if run is None:
        raise ValueError(f"run {run_id} not found")
    issuer = await session.get(Issuer, run.issuer_id)
    if issuer is None:
        raise ValueError(f"issuer {run.issuer_id} not found")

    modules = [
        m for m in (await session.execute(
            select(ModuleOutput).where(ModuleOutput.run_id == run_id).order_by(ModuleOutput.created_at)
        )).scalars().all()
        if m.module_id not in _NON_CONTENT
    ]
    claims = list((await session.execute(
        select(Claim).where(Claim.module_output_id.in_([m.id for m in modules]))
    )).scalars().all()) if modules else []
    ev_by_claim: dict[str, List[Any]] = {c.id: [] for c in claims}
    if claims:
        for e in (await session.execute(
            select(EvidenceItem).where(EvidenceItem.claim_pk.in_(list(ev_by_claim)))
        )).scalars().all():
            ev_by_claim[e.claim_pk].append(e)
    claims_by_output: dict[str, list] = {m.id: [] for m in modules}
    for c in claims:
        claims_by_output[c.module_output_id].append(c)

    sections = [
        {
            "module_id": m.module_id, "module_name": m.module_name,
            "confidence": m.confidence, "qa_status": m.qa_status,
            "summary": m.runtime_output,
            "claims": [
                {"claim_id": c.claim_id, "claim_text": c.claim_text,
                 "evidence": [{"evidence_id": e.evidence_id} for e in ev_by_claim[c.id]]}
                for c in claims_by_output[m.id]
            ],
        }
        for m in modules
    ]
    issuer_runs = (await session.execute(
        select(Run).where(Run.issuer_id == run.issuer_id)
    )).scalars().all()
    findings = (await session.execute(
        select(QAFinding).where(QAFinding.run_id == run_id)
    )).scalars().all()
    # Peer edges for the Graph view: CP-1C persists its peer set (id + name); turn
    # the names into issuer↔issuer [[links]] on the hub. Empty when CP-1C didn't run.
    cp1c = next((m for m in modules if m.module_id == "CP-1C"), None)
    related = [p["name"] for p in ((cp1c.runtime_output or {}).get("peers") or [])] if cp1c else []

    return write_run_to_vault(
        vault_dir,
        {"name": issuer.name, "ticker": issuer.ticker,
         "industry": issuer.industry, "country": issuer.country},
        {"id": run.id, "as_of_date": run.as_of_date,
         "qa_status": run.qa_status, "committee_status": run.committee_status},
        sections,
        [{"id": r.id, "as_of_date": r.as_of_date,
          "qa_status": r.qa_status, "committee_status": r.committee_status} for r in issuer_runs],
        findings=[{"severity": f.severity, "lane": f.lane, "module_id": f.module_id,
                   "description": f.description, "required_remediation": f.required_remediation}
                  for f in findings],
        related_issuers=related,  # CP-1C peer names → issuer↔issuer graph links
    )


# ── Analyst memo intake (uploaded market/research commentary) ────────────────
# The folder sync_analyst_memos scans and the Query graph's obsidian:// deep
# links point at — keep the two in step.
MEMOS_DIR = "Analyst-Memos"

_WIKILINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")


def _mention_pattern(term: str) -> str:
    """Whole-word-ish pattern for an issuer mention. ``\\b`` only works against a
    word char, so it is applied per edge — a legal name ending '.', e.g.
    'Acme Holdings Corp.', must still match before a space."""
    lead = r"\b" if term[:1].isalnum() else ""
    tail = r"\b" if term[-1:].isalnum() else ""
    return rf"(?<!\[){lead}({re.escape(term)}){tail}(?!\])"


def autolink_issuers(
    text: str, issuers: Sequence[Tuple[str, Optional[str]]]
) -> Tuple[str, List[str]]:
    """Wrap the first plain mention of each known issuer in a ``[[wikilink]]`` so
    an uploaded memo links itself into the issuer graph without the analyst
    hand-writing links. The full name matches case-insensitively (the link keeps
    the memo's own casing — ``sync_analyst_memos`` resolves targets lowercased);
    the ticker is the fallback, matched case-sensitively as a whole word and only
    when ≥2 chars (so Ford's 'F' can't eat every letter F). An issuer already
    wikilinked in the text is counted but left untouched.

    Returns ``(linked_text, [issuer names now referenced by a wikilink])``.
    """
    linked: List[str] = []
    existing = {m.group(1).strip().lower() for m in _WIKILINK_RE.finditer(text)}
    for name, ticker in issuers:
        if not (name or "").strip():
            continue
        tick = (ticker or "").strip()
        if name.lower() in existing or (tick and tick.lower() in existing):
            linked.append(name)
            continue
        # ponytail: lookarounds only block a match hard against [[ ]] brackets —
        # a name inside an alias label can still double-wrap; fine for memos.
        m = re.search(_mention_pattern(name), text, re.IGNORECASE)
        if m is None and len(tick) >= 2:
            m = re.search(_mention_pattern(tick), text)
        if m is None:
            continue
        text = f"{text[:m.start(1)]}[[{m.group(1)}]]{text[m.end(1):]}"
        linked.append(name)
    return text, linked


def memo_note_title(file_name: str) -> str:
    """Vault-safe note title from an uploaded filename — basename, no extension,
    illegal filesystem/wikilink chars stripped (also kills path traversal)."""
    return _title(Path(file_name).stem)


def render_memo(
    title: str,
    memo_type: str,
    uploaded_by: str,
    source_file: str,
    body: str,
    date: Optional[str] = None,
) -> str:
    """An uploaded analyst memo as a vault note: frontmatter for metadata queries
    + H1 + the memo body verbatim (already auto-wikilinked)."""
    head = _yaml_block({
        "type": "analyst-memo",
        "memo_type": memo_type,
        "uploaded_by": uploaded_by,
        "source_file": source_file,
        "date": date,
    })
    return f"{head}\n\n# {title}\n\n{body.strip()}\n"


def write_memo(vault_dir: str | Path, title: str, md: str) -> Path:
    """Write a memo into ``{vault}/Analyst-Memos/``, deduping the filename
    ('Title - 2.md', 'Title - 3.md', …) rather than overwriting an analyst's
    earlier note — uploads are analyst-authored, so unlike run notes there is no
    canonical DB row to make an overwrite safe."""
    d = Path(vault_dir) / MEMOS_DIR
    d.mkdir(parents=True, exist_ok=True)
    path = d / f"{title}.md"
    n = 2
    while path.exists():
        path = d / f"{title} - {n}.md"
        n += 1
    path.write_text(md, encoding="utf-8")
    return path


_last_vault_mtime = 0.0
_last_vault_file_count = 0


async def sync_analyst_memos(session) -> int:  # noqa: C901
    """Scan the vault directory (excluding Issuers/ and Runs/) for analyst-written
    Markdown files, parsing [[wikilinks]] that reference known issuers. Caches
    resolved links into the analyst_links table (syncing additions and deletions).
    """
    from sqlalchemy import select, delete
    from database import Issuer, AnalystLink
    from config import get_settings
    import re
    import os

    settings = get_settings()
    if not settings.vault_export_dir:
        return 0

    vault_path = Path(settings.vault_export_dir)
    if not vault_path.exists() or not vault_path.is_dir():
        return 0

    global _last_vault_mtime, _last_vault_file_count
    md_files = []
    for p in vault_path.rglob("*.md"):
        parts = p.relative_to(vault_path).parts
        if parts and parts[0] in ("Runs", "Issuers"):
            continue
        md_files.append(p)

    if not md_files:
        if _last_vault_file_count > 0:
            await session.execute(delete(AnalystLink))
            _last_vault_file_count = 0
            _last_vault_mtime = 0.0
            return 1
        return 0

    max_mtime = max(os.path.getmtime(f) for f in md_files)
    file_count = len(md_files)

    if max_mtime == _last_vault_mtime and file_count == _last_vault_file_count:
        return 0

    issuers = (await session.execute(select(Issuer))).scalars().all()
    issuer_map = {}
    for iss in issuers:
        issuer_map[iss.name.lower().strip()] = iss.id
        if iss.ticker:
            issuer_map[iss.ticker.lower().strip()] = iss.id

    parsed_links = []
    link_re = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")

    for p in vault_path.rglob("*.md"):
        parts = p.relative_to(vault_path).parts
        if parts and parts[0] in ("Runs", "Issuers"):
            continue

        try:
            content = p.read_text(encoding="utf-8")
        except Exception:
            continue

        note_name = p.stem
        lines = content.splitlines()
        for idx, line in enumerate(lines):
            for match in link_re.finditer(line):
                target_name = match.group(1).strip()
                target_id = issuer_map.get(target_name.lower())
                if target_id:
                    excerpt = line.strip()
                    excerpt = link_re.sub(r"\1", excerpt)
                    parsed_links.append({
                        "source_note": note_name,
                        "target_issuer_id": target_id,
                        "excerpt": excerpt[:200] or f"Note: {note_name}"
                    })

    await session.execute(delete(AnalystLink))

    count = 0
    for link_data in parsed_links:
        link = AnalystLink(
            source_note=link_data["source_note"],
            target_issuer_id=link_data["target_issuer_id"],
            excerpt=link_data["excerpt"]
        )
        session.add(link)
        count += 1

    _last_vault_mtime = max_mtime
    _last_vault_file_count = file_count
    return count


if __name__ == "__main__":  # ponytail: one runnable self-check for the render/link logic
    _issuer = {"name": "Acme Corp / EU", "ticker": "ACME", "industry": "Industrials", "country": "US"}
    _run = {"id": "1234abcd-0000", "as_of_date": "2026-06-21",
            "qa_status": "Pass", "committee_status": "Committee Ready"}
    _sections = [{
        "module_id": "CP-1", "module_name": "Financial Foundation",
        "confidence": "High", "qa_status": "Pass",
        "summary": {"net_leverage": 4.2, "liquidity": {"rcf_undrawn": 150}},
        "claims": [{"claim_id": "C-01", "claim_text": "Leverage rose to 4.2x.",
                    "evidence": [{"evidence_id": "E-01"}, {"evidence_id": "E-02"}]}],
    }]
    _findings = [{"severity": "MATERIAL", "lane": 6, "module_id": "CP-1",
                  "description": "Weak lineage on E-44.", "required_remediation": "Re-anchor E-44."}]
    spoke_md = render_run_spoke(_issuer, _run, _sections, _findings)
    hub_md = render_issuer_hub(_issuer, [_run])

    # filename and wikilink target must match (Obsidian resolves links by basename)
    st = spoke_title(_issuer["name"], _run)
    assert "/" not in st and ":" not in st, st            # illegal chars stripped
    assert f"[[{st}]]" in hub_md, "hub must link the spoke by its exact title"
    assert f"[[{hub_title(_issuer['name'])}]]" in spoke_md, "spoke must back-link the hub"
    assert spoke_md.startswith("---\n") and "\n---\n" in spoke_md, "frontmatter block"
    assert "## Financial Foundation (CP-1)" in spoke_md, "module = header (chunk split point)"
    assert "net_leverage" in spoke_md, "scalar agent output stored"
    assert "```json" in spoke_md, "nested agent output stored whole as a JSON block"
    assert "`[E-01]` `[E-02]`" in spoke_md, "claim carries its evidence citations"
    assert "## QA findings" in spoke_md and "Re-anchor E-44." in spoke_md, "gate output stored"
    assert '"Committee Ready"' in spoke_md, "status stamped in frontmatter"
    assert "[[Industrials]]" in hub_md and "[[US]]" in hub_md, "sector/geo graph links"

    # analyst memo intake: auto-wikilink + render
    _memo_txt, _linked = autolink_issuers(
        "Spreads widened. acme corp / eu reported; peers [[Beta Industries]] and BETA held.",
        [("Acme Corp / EU", "ACME"), ("Beta Industries", "BETA"), ("Gamma Plc", "F")],
    )
    assert "[[acme corp / eu]]" in _memo_txt, "name auto-wikilinked (memo casing kept)"
    assert _memo_txt.count("[[Beta Industries]]") == 1, "already-linked issuer untouched"
    assert set(_linked) == {"Acme Corp / EU", "Beta Industries"}, _linked
    assert "[[F]]" not in _memo_txt, "1-char ticker never matched"
    _memo_md = render_memo("Weekly Wrap", "market-commentary", "a@b.c", "wrap.pdf",
                           _memo_txt, date="2026-07-02")
    assert _memo_md.startswith("---\n") and '"analyst-memo"' in _memo_md
    assert "# Weekly Wrap" in _memo_md and "[[acme corp / eu]]" in _memo_md
    assert memo_note_title("../..\\evil:note?.md") and all(
        c not in memo_note_title("../..\\evil:note?.md") for c in '\\/:?'
    ), "memo title sanitized"
    print("vault_export self-check OK")
    print("---- spoke ----\n" + spoke_md)
