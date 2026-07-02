"""Analyst memo upload → Obsidian vault: pure helpers (vault_export) and the
/api/ingestion/upload/memo route, including the sync into analyst_links and the
Query graph read-back."""

import os

import pytest
from fastapi.testclient import TestClient

import vault_export
from vault_export import autolink_issuers, memo_note_title, render_memo, write_memo

AUTH = {"X-Forwarded-Email": "analyst@corp.com"}


# ── autolink_issuers (pure) ───────────────────────────────────────────────────

def test_autolink_wraps_first_name_mention_only():
    text, linked = autolink_issuers(
        "Acme Corp reported; Acme Corp guided lower.", [("Acme Corp", "ACME")]
    )
    assert text.count("[[") == 1
    assert text.startswith("[[Acme Corp]] reported")
    assert linked == ["Acme Corp"]


def test_autolink_matches_name_case_insensitively_keeps_memo_casing():
    text, linked = autolink_issuers("watch acme corp today", [("Acme Corp", None)])
    assert "[[acme corp]]" in text
    assert linked == ["Acme Corp"]


def test_autolink_falls_back_to_ticker_word():
    text, linked = autolink_issuers(
        "VMED prints tomorrow.", [("Virgin Media O2", "VMED")]
    )
    assert "[[VMED]]" in text
    assert linked == ["Virgin Media O2"]


def test_autolink_ticker_word_bounded_and_case_sensitive():
    text, linked = autolink_issuers(
        "beta-max betamax Beta prints.", [("Beta Industries", "BETA")]
    )
    assert "[[" not in text
    assert linked == []


def test_autolink_skips_already_linked_issuer():
    text, linked = autolink_issuers(
        "[[Acme Corp]] again: Acme Corp.", [("Acme Corp", "ACME")]
    )
    assert text.count("[[") == 1
    assert linked == ["Acme Corp"]


def test_autolink_ignores_one_char_ticker():
    text, linked = autolink_issuers("Grade F quarter, no names.", [("Ford Motor", "F")])
    assert "[[" not in text
    assert linked == []


def test_autolink_matches_legal_name_with_trailing_dot():
    text, linked = autolink_issuers(
        "Spreads tightened; Acme Holdings Corp. looks rich vs peers.",
        [("Acme Holdings Corp.", "ACME")],
    )
    assert "[[Acme Holdings Corp.]]" in text
    assert linked == ["Acme Holdings Corp."]


# ── render/write helpers (pure / fs-only) ─────────────────────────────────────

def test_render_memo_frontmatter_title_body():
    md = render_memo("Weekly Wrap", "market-commentary", "a@b.c", "wrap.pdf",
                     "Body text.", date="2026-07-02")
    assert md.startswith("---\n")
    assert '"analyst-memo"' in md and '"market-commentary"' in md and '"a@b.c"' in md
    assert "# Weekly Wrap" in md and "Body text." in md


def test_write_memo_dedupes_instead_of_overwriting(tmp_path):
    p1 = write_memo(tmp_path, "Note", "one")
    p2 = write_memo(tmp_path, "Note", "two")
    assert p1.name == "Note.md" and p2.name == "Note - 2.md"
    assert p1.read_text() == "one" and p2.read_text() == "two"
    assert p1.parent.name == vault_export.MEMOS_DIR


def test_memo_title_sanitizes_traversal_and_illegal_chars():
    t = memo_note_title("../..\\evil:note?.md")
    assert t
    assert all(c not in t for c in '\\/:?*"<>|[]#^')


# ── route ────────────────────────────────────────────────────────────────────

@pytest.fixture
def client(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("caos-memo")
    os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{tmp / 'test.db'}")
    os.environ.setdefault("CAOS_STORAGE_DIR", str(tmp / "storage"))
    from main import app  # imported after env is set (conftest already set the shared DB)

    with TestClient(app) as c:
        yield c


@pytest.fixture
def vault_dir(tmp_path, monkeypatch):
    """Point vault_export_dir at a fresh dir and reset the memo-sync mtime cache
    (module-global, so a previous test's scan must not mask this dir's files)."""
    import config

    patched = config.get_settings().model_copy(update={"vault_export_dir": str(tmp_path)})
    monkeypatch.setattr(config, "get_settings", lambda: patched)
    vault_export._last_vault_mtime = 0.0
    vault_export._last_vault_file_count = 0
    yield tmp_path
    vault_export._last_vault_mtime = 0.0
    vault_export._last_vault_file_count = 0


def _post_memo(client, filename, body, memo_type="market-commentary"):
    return client.post(
        "/api/ingestion/upload/memo",
        headers=AUTH,
        data={"memo_type": memo_type},
        files={"file": (filename, body, "text/markdown")},
    )


def test_upload_memo_vaults_autolinks_and_feeds_query_graph(client, vault_dir):
    issuers = client.get("/api/issuers", headers=AUTH).json()
    assert issuers, "demo seed expected"
    issuer = issuers[0]

    r = _post_memo(client, "Weekly Wrap.md",
                   f"# Desk note\n\nSpreads tightened; {issuer['name']} looks rich vs peers.\n".encode())
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["note"] == "Weekly Wrap"
    assert out["path"] == "Analyst-Memos/Weekly Wrap.md"
    assert out["memo_type"] == "market-commentary"
    assert issuer["name"] in out["issuer_links"]

    written = vault_dir / "Analyst-Memos" / "Weekly Wrap.md"
    assert written.exists()
    md = written.read_text()
    assert md.startswith("---\n")
    assert f"[[{issuer['name']}]]" in md

    # the sync landed in analyst_links → the Query graph shows the memo node
    g = client.post("/api/query/graph", headers=AUTH,
                    json={"capability_id": "analyst-memos", "issuer_id": issuer["id"]})
    assert g.status_code == 200, g.text
    assert "Weekly Wrap" in [n["label"] for n in g.json()["nodes"]]


def test_upload_memo_dedupes_filename(client, vault_dir):
    issuers = client.get("/api/issuers", headers=AUTH).json()
    body = f"Note on {issuers[0]['name']}.".encode()
    first = _post_memo(client, "Same Name.md", body)
    second = _post_memo(client, "Same Name.md", body)
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["path"] == "Analyst-Memos/Same Name.md"
    assert second.json()["path"] == "Analyst-Memos/Same Name - 2.md"
    assert second.json()["note"] == "Same Name - 2"


def test_upload_memo_traversal_filename_stays_inside_vault(client, vault_dir):
    r = _post_memo(client, "../../escape.md", b"no links here")
    assert r.status_code == 200, r.text
    memos = vault_dir / "Analyst-Memos"
    written = list(memos.glob("*.md"))
    assert len(written) == 1
    assert written[0].resolve().is_relative_to(vault_dir.resolve())


def test_upload_memo_503_when_no_vault_configured(client, monkeypatch):
    import config

    patched = config.get_settings().model_copy(update={"vault_export_dir": ""})
    monkeypatch.setattr(config, "get_settings", lambda: patched)
    r = _post_memo(client, "note.md", b"text")
    assert r.status_code == 503


def test_upload_memo_rejects_unsupported_extension(client, vault_dir):
    r = _post_memo(client, "note.docx", b"text")
    assert r.status_code == 400
    assert ".md" in r.json()["detail"]


def test_upload_memo_rejects_unknown_memo_type(client, vault_dir):
    r = _post_memo(client, "note.md", b"text", memo_type="hot-take")
    assert r.status_code == 400


def test_upload_memo_422_when_pdf_has_no_text(client, vault_dir):
    r = client.post(
        "/api/ingestion/upload/memo",
        headers=AUTH,
        data={"memo_type": "research"},
        files={"file": ("scan.pdf", b"%PDF-1.4\nnot really a pdf", "application/pdf")},
    )
    assert r.status_code == 422
