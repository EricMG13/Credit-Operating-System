from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

import market_storage
import model_storage


@pytest.mark.parametrize("storage", [model_storage, market_storage])
@pytest.mark.parametrize(
    "filename",
    [
        "a" * 214 + ".xlsx",  # 219-byte component
        "b" * 235 + ".xlsx",  # 240-byte component
        "c" * 500 + ".xlsx",  # over NAME_MAX before normalization
        "信" * 500 + ".xlsx",  # long Unicode input normalizes safely
    ],
)
def test_atomic_storage_bounds_final_and_temp_components(
    storage, filename: str, tmp_path: Path, monkeypatch
):
    root = tmp_path / storage.__name__
    monkeypatch.setattr(
        storage,
        "get_settings",
        lambda: SimpleNamespace(caos_storage_dir=str(root)),
    )

    key = storage.store_atomic(b"workbook", filename)
    stored = root / key

    assert stored.read_bytes() == b"workbook"
    assert len(stored.name.encode("utf-8")) <= 240
    assert not (stored.parent / ".upload.tmp").exists()


@pytest.mark.parametrize(
    ("storage", "prefix", "fallback"),
    [
        (model_storage, "models/", "model.xlsx"),
        (market_storage, "market/", "market.xlsx"),
    ],
)
def test_storage_rejects_escaped_or_wrong_keys_and_uses_safe_fallback(
    storage, prefix: str, fallback: str, tmp_path: Path, monkeypatch,
):
    root = tmp_path / storage.__name__
    monkeypatch.setattr(
        storage, "get_settings",
        lambda: SimpleNamespace(caos_storage_dir=str(root)),
    )

    assert storage._safe_basename(".") == fallback
    with pytest.raises(ValueError, match="escaped"):
        storage._path_for("../outside")
    with pytest.raises(ValueError, match="Refusing"):
        storage.remove_uncommitted("other/object.xlsx")

    key = storage.store_atomic(b"workbook", "book.xlsx")
    stored = root / key
    (stored.parent / "keep").write_text("occupied", encoding="utf-8")
    storage.remove_uncommitted(key)
    assert not stored.exists() and stored.parent.exists()


@pytest.mark.parametrize("storage", [model_storage, market_storage])
def test_atomic_storage_cleanup_tolerates_secondary_os_errors(
    storage, tmp_path: Path, monkeypatch,
):
    root = tmp_path / storage.__name__
    monkeypatch.setattr(
        storage, "get_settings",
        lambda: SimpleNamespace(caos_storage_dir=str(root)),
    )
    monkeypatch.setattr(storage.os, "replace", lambda *_args: (_ for _ in ()).throw(
        RuntimeError("replace failed")
    ))
    monkeypatch.setattr(Path, "unlink", lambda *_args, **_kwargs: (_ for _ in ()).throw(
        OSError("cleanup failed")
    ))

    with pytest.raises(RuntimeError, match="replace failed"):
        storage.store_atomic(b"workbook", "book.xlsx")
