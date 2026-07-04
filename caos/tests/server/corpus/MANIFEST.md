# Broad-Run Test Corpus — 33 Issuers (Phase B / B5)

*(30-name analyst cohort + 3 foreign reported-lane names added 2026-07-03 to
thicken the `reported_cp1` path.)*

Breadth net for engine certification. **Distinct from the sealed golden set**
(`../golden/`): goldens assert *exact numbers forever* (hand-verified, 3
names); this corpus asserts *clean run* across 30 real leveraged-credit issuers
with **no numeric oracle** — cheap to add, catches breadth/robustness bugs 3
issuers never surface (odd XBRL tags, foreign domicile, IFRS, ingestion edges,
covenant-retrieval misses, NaN leaks under real data).

**Source:** analyst-curated cohort (2026-07-03), 30 names in **5 sectors × 6**,
plus 3 foreign reported-lane additions (one each into Telecom, Industrials,
Gaming → those three run 7-deep). Every sector a real leveraged-credit
vertical, ≥6-deep so CP-3 peer percentiles / Sector RV have a populated peer
group per sector.

## Assertions per issuer (property, not value)

Full 19-module DAG completes on **both lanes** (keyless EDGAR/reported + keyed
LLM synth) with, for each issuer:
- no unhandled exception through the DAG or CP-5 gate;
- CP-5 QA gate emits a status (fires honestly — not a rubber-stamp pass);
- every claim's `claim → evidence → chunk` citation resolves (no dangling id);
- `is_finite_number` holds on all CP-1 divides/multiplies (no NaN/inf leak);
- DM, where computed, lands in a plausible band (PR #95 guard);
- no surface returns a mock number tagged `prov=run`.

**Promotion rule:** any corpus issuer that exposes a *class* of bug is
hand-verified once and **promoted into the frozen golden set** — the cheap net
feeds the expensive net. This is how the golden set grows past 3 without 30
days of up-front verification.

## Lane composition

| Lane | Count | Names |
|------|-------|-------|
| EDGAR XBRL (US-GAAP, has CIK) | 28 | all except the 5 below |
| Reported-disclosure (`reported_cp1`, no CIK) | 5 | VMO2 (golden), Refresco, Altice France/SFR, INEOS, Cirsa |

**Known deltas — read before capture:**
- **Reported lane thickened to 5** (was 2). VMO2 + Refresco + 3 true foreign
  IFRS/bond-only names (SFR 🇫🇷, INEOS 🇬🇧/🇨🇭, Cirsa 🇪🇸) now give the
  `reported_cp1` path real stress across France/UK/Spain disclosure formats.
  All 5 are non-US, no SEC CIK, publish to bondholders via IR — reported lane,
  not EDGAR.
- **No scanned-PDF issuer here.** IR decks are native PDFs. D1's OCR lane needs
  its own genuinely-scanned fixture sourced separately — this corpus does not
  cover it.
- **4 non-US-domicile filers** (OpenText 🇨🇦, Bausch 🇨🇦, Clarivate 🇬🇧,
  Liberty Global 🇬🇧) file via EDGAR — bonus non-US entity/currency coverage
  inside the XBRL lane. **At capture, confirm form 10-K vs 20-F:** a 20-F ⇒
  IFRS tags via EDGAR, which is valuable extra coverage; note it on the row.
- **VMO2 overlaps the golden set** — kept as the reported-lane anchor (known-
  good). Corpus run may reuse the golden fixture rather than re-capture.

## The 33

Core 30 CIKs as supplied; 3 foreign reported-lane names have no CIK. Capture = one live SEC/doc fetch each, trimmed + frozen as an
offline fixture (`_capture.py` pattern) so the corpus runs keyless in CI.

### Software / Data & Analytics
| Issuer | Ticker | CIK | Lane |
|--------|--------|-----|------|
| SS&C Technologies | SSNC | 0001004155 | EDGAR |
| OpenText | OTEX | 0001062509 | EDGAR (🇨🇦 — confirm 10-K/20-F) |
| Gen Digital | GEN | 0000849399 | EDGAR |
| GoDaddy | GDDY | 0001609711 | EDGAR |
| Clarivate | CLVT | 0001764046 | EDGAR (🇬🇧 — confirm 10-K/20-F) |
| Dun & Bradstreet | DNB | 0001799208 | EDGAR |

### Healthcare / Pharma
| Issuer | Ticker | CIK | Lane |
|--------|--------|-----|------|
| Bausch Health | BHC | 0001300846 | EDGAR (🇨🇦 — confirm 10-K/20-F) |
| Tenet Healthcare | THC | 0000070318 | EDGAR |
| Community Health | CYH | 0001108109 | EDGAR |
| Avantor | AVTR | 0001758632 | EDGAR |
| Elanco | ELAN | 0001739940 | EDGAR |
| Organon | OGN | 0001840776 | EDGAR |

### Telecom / Cable / Media
| Issuer | Ticker | CIK | Lane |
|--------|--------|-----|------|
| Altice USA | ATUS | 0001702780 | EDGAR |
| Charter Communications | CHTR | 0001091667 | EDGAR |
| Lumen | LUMN | 0000018926 | EDGAR |
| Liberty Global | LBTYA | 0001570585 | EDGAR (🇬🇧 — confirm 10-K/20-F) |
| Virgin Media O2 | VMO2 | — (UK filer) | Reported — **golden anchor** |
| Sinclair | SBGI | 0000812011 | EDGAR |
| Altice France / SFR | private | — (🇫🇷 filer) | Reported — bond/loan issuer; contrast vs Altice USA (EDGAR). IR URL verify at capture |

### Industrials / Materials / Packaging
| Issuer | Ticker | CIK | Lane |
|--------|--------|-----|------|
| TransDigm | TDG | 0001260221 | EDGAR |
| Berry Global | BERY | 0001378992 | EDGAR |
| Axalta | AXTA | 0001616862 | EDGAR |
| Builders FirstSource | BLDR | 0001009829 | EDGAR |
| Chemours | CC | 0001627223 | EDGAR |
| Refresco | private | — (Euro filer) | Reported — bond-only |
| INEOS | private | — (🇬🇧/🇨🇭 filer) | Reported — bond-only chemicals; bondholder reports via IR. URL verify at capture |

### Gaming / Leisure / Travel
| Issuer | Ticker | CIK | Lane |
|--------|--------|-----|------|
| Caesars Entertainment | CZR | 0001590895 | EDGAR |
| Aramark | ARMK | 0001573297 | EDGAR |
| Penn Entertainment | PENN | 0000892013 | EDGAR |
| Hilton Grand Vacations | HGV | 0001676936 | EDGAR |
| United Airlines | UAL | 0000100517 | EDGAR |
| Boyd Gaming | BYD | 0000906553 | EDGAR |
| Cirsa | private | — (🇪🇸 filer) | Reported — HY-bond gaming (IFRS); bondholder reports via IR. URL verify at capture |

## Runtime

33 × both-lanes must stay CI-affordable. Parallelize; target < ~5 min wall
nightly. Per-PR runs a 6-issuer smoke subset (one per sector — SSNC, THC,
CHTR, TDG, CZR + VMO2 reported-lane) to keep the gate fast.
