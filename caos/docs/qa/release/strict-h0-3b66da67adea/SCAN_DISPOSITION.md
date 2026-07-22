# H0 image-scan disposition — strict-h0-3b66da67adea

Closes the `image_scan_disposition` manual slot in
[RELEASE_MANIFEST.json](RELEASE_MANIFEST.json). Scope is the exact recorded
artifacts (verify hashes before relying on this document):

| Artifact | sha256 |
|---|---|
| `image-scan.sarif.json` (Trivy, `caos-app@sha256:882efb398526…`) | `fe8011896bb642f9c37b079c4949e8dde2b1b5fe0d84f041cbbf78e86a346e7c` |
| `pip-audit.json` (production lock) | `7a542ea0b990207d526473653410fdd8ec528ad4a6cb5516e9ca29a2759af74b` |
| `npm-audit.json` (frontend, prod+dev) | `57f6f2ddfb6f7d687a897f6511adb497280649a7448ef5f84bc8f2b7cf4f48bc` |

## 1. Application dependencies — clean

- **pip-audit: 0 vulnerabilities** across the hashed production lock.
- **npm audit: 0 vulnerabilities** (info through critical) across 930
  resolved packages.

No application-level finding exists; nothing to waive.

## 2. OS-layer scan (Trivy) — 387 findings, all Debian trixie base packages

Breakdown: **66 error-level (HIGH/CRITICAL)** across 28 packages, 138
warning-level (MEDIUM) across 41 packages, 183 note-level (LOW/unknown)
across 60 packages.

**Every one of the 66 error-level findings has no fixed version available in
Debian trixie** (verified programmatically from the SARIF: 66/66 carry an
empty `Fixed Version`). There is no upgrade action that removes any of them;
the only alternatives would be a different base distribution or waiting for
`deb13uN` point updates. The same holds for the warning/note tiers, which are
dominated by long-standing no-fix Debian advisories.

### Error-level findings by package group and verdict

| Group | Packages (findings) | Reachability in this image | Verdict |
|---|---|---|---|
| Untrusted-input parsers | `python3-pil` (11), `libexpat1` (6), `python3-pdfminer` (1), `libxml2` (1), `libtiff6` (1) | Real: the ingestion lane parses analyst-uploaded PDFs (markitdown → pdfminer; PIL/tiff for embedded images). Compensating controls: ClamAV scan **before** any parse, path-safe extraction, uploads restricted to authenticated analysts behind the edge proxy, app runs as UID 10001 with a read-only governed context | **Accept with monitoring** — highest-priority group for the rebuild trigger below |
| HTTP client | `libcurl4t64` (7) | App outbound calls use Python `httpx`/`requests` wheels, not the system curl binary; libcurl sits unused by the service path | **Accept** — not on the service path |
| glib/desktop stack | `libglib2.0-0t64` (7), `libcups2t64` (1) | Pulled in by WeasyPrint/report rendering chain; no CUPS printing, no glib network services exposed | **Accept** — library present, vulnerable surfaces unexercised |
| Shell/userland | `perl-base` (8), `gzip` (1), `bsdutils`/`mount`/`login`/util-linux family (7 across 7 pkgs), `ncurses` family (4), `libacl1` (1) | No perl, gzip, mount, or interactive login is invoked by the service; container runs a single non-root Python entrypoint | **Accept** — dormant userland |
| Python runtime | `libpython3.13-minimal` (2), `libpython3.13-stdlib` (2) | Debian system python — the app runs on its own interpreter/venv layer; system python is not the service interpreter | **Accept**; covered by rebuild trigger |
| Remainder | single-CVE entries (`libjbig2dec0` via ghostscript chain, etc.) | Report/PDF rendering chain, offline only | **Accept** |

### Why acceptance is sound here

1. **No fix exists** — 0 of 66 error-level findings are upgradeable today.
2. **Runtime posture bounds exposure**: non-root UID 10001, deny-by-default
   build context (3.88 MB), no shell service, single entrypoint, network
   ingress only via Caddy → oauth2-proxy, DB and vault on the internal
   network, third-party images digest-pinned.
3. **The reachable-parser group has layered controls**: ClamAV-before-parse,
   authenticated-only upload, fault-isolated parse lane (a parser crash fails
   the one ingestion job, not the service).

### Standing conditions (part of this disposition)

- **Rebuild trigger**: when Debian ships a `deb13uN` fix for any package in
  the *untrusted-input parsers* group, rebuild the image, rerun the strict
  manifest generator, and re-freeze. Check at every H-phase gate and at least
  monthly post-transfer (owner: platform operator, alongside L18 quarterly
  security review).
- **New-CVE watch**: a rerun of Trivy on the *same* frozen digest that
  surfaces a **new** error-level finding in the parsers group reopens this
  disposition; other new no-fix base findings are recorded, not blocking.
- This disposition covers image `sha256:882efb398526…` only (re-verified on the
  3b66da67 rescan: identical 387-finding profile, 66/66 error-level still
  no-fix). Any new image
  digest requires a fresh scan and a fresh disposition.

## 3. Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Owner / release authority | ____________ | ☐ Accept per above | ______ |

Prepared 2026-07-22 against the re-frozen candidate `3b66da67` (config-only
delta from `cda106dc`: vault-init service + gitleaks allowlist + evidence
docs; identical image) /
`sha256:882efb398526…`.
