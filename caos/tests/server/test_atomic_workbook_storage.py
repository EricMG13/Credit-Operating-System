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
