"""Offline checks for the cohort-fetcher predicates (no network).

Single import: `fetch_cohort` adds server/ to sys.path on load, so `fetch_cohort.edgar`
is reachable without a separate (order-fragile) top-level `import edgar`.
"""
import fetch_cohort as fc


def _ex(name, label):
    return fc.edgar.Exhibit(name=name, url=f"https://www.sec.gov/Archives/{name}",
                            doc_label=label, authority_rank=None)


def test_in_window():
    assert fc.in_window("2023-05-01", "2022-01-01", "2025-12-31")
    assert fc.in_window("2022-01-01", "2022-01-01", "2025-12-31")  # inclusive
    assert not fc.in_window("2021-12-31", "2022-01-01", "2025-12-31")
    assert not fc.in_window("2026-01-01", "2022-01-01", "2025-12-31")
    assert not fc.in_window("", "2022-01-01", "2025-12-31")


def test_keep_legal_exhibit():
    assert fc.keep_legal_exhibit(_ex("d123.htm", "Credit Agreement"))         # by classification
    assert fc.keep_legal_exhibit(_ex("ex-10.1.htm", "Other / Unclassified"))  # by EX-10.1 slot
    assert fc.keep_legal_exhibit(_ex("ex10_2.htm", "Other / Unclassified"))
    assert not fc.keep_legal_exhibit(_ex("ex-21.htm", "Other / Unclassified"))
    assert not fc.keep_legal_exhibit(_ex("ex-99.1.htm", "Marketing / Press (Ex-99)"))


def test_keep_ex99():
    assert fc.keep_ex99(_ex("ex-99.1.htm", "Marketing / Press (Ex-99)"))
    assert not fc.keep_ex99(_ex("ex-10.1.htm", "Credit Agreement"))


def test_safe_filename():
    assert fc._safe("8-K_2023-05-01_0001/../etc passwd") == "8-K_2023-05-01_0001_.._etc_passwd"
