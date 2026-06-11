# CAOS Master Blueprint — Frontend & Credit Cockpit Architecture

> **Status:** Partially implemented. **F1, F3, F4, F5 and the §7.1 tests are built**
> against a demo data source (`caos/demo_mock_backend.py`): global nav + L0–L6
> execution mesh, 5-stage workflow header, Analysis tab with markdown narrative +
> inline citation badges, three-tier Evidence Trace panel, and cross-pane Evidence
> Sync (citation / covenant / scatter → shared selection → clause highlight). Unit
> tests (Vitest, `src/lib/citations.test.ts`) and E2E (Playwright,
> `tests/frontend/e2e/evidence_sync.spec.ts`) are green.
> **Still pending: F2 (real backend anchors/endpoints + `[[cite:n]]` from agent prompts)
> and F6 (true PDF coordinate highlight).** The demo uses a text-clause vault.
> **Scope of this revision:** Front-end UI/UX architecture for the analyst workspace —
> Global Navigation + Agent Execution Mesh, the resizable Source Vault / Credit Cockpit
> split-pane, the Analysis narrative, and the cross-pane **Evidence Trace** interaction.
> **Owner:** Frontend / UX. **Consumers:** `caos/frontend`, plus the schema/ingestion
> changes in `caos/backend` that this UI depends on.

---

## 0. Where this document lives (and why)

**Decision: a new `caos/docs/CAOS_Master_Blueprint.md` inside the implementation repo — _not_ the root `CP-*.txt` convention.**

Two candidate homes were considered:

| Option | Verdict | Reasoning |
|---|---|---|
| Root `CP-*.txt` agent-doc convention | ❌ Rejected | The `CP-*.txt` files at the project root are **agent-runtime prompt contracts** — system prompts, payload schemas, and analytical standards that are concatenated into LLM context. A UI/UX blueprint is a different audience (engineers, not the model); putting it there pollutes agent context, has no schema, and breaks the one-concern-per-file pattern those files follow. |
| `caos/docs/CAOS_Master_Blueprint.md` (new) | ✅ Chosen | Lives **with the code it governs**, versioned in the same repo, reviewable in the same PRs as the components it specifies. It can grow into a true master blueprint (backend, data, infra sections appended later); this revision populates the **Frontend** section only. |

This file maps to the user's framing of *"Section 5: Visual Component Factory & Frontend UI"* and *"Phase 5: Enterprise Frontend & Time-Series UI."*

---

## 1. Current state (grounded in the codebase)

What exists today, so the plan is additive rather than speculative:

| Capability | Today | File |
|---|---|---|
| Split-pane Vault ↔ Cockpit | ✅ Exists, drag handle, 20–70% clamp | [`CreditCockpit.tsx`](../frontend/src/components/cockpit/CreditCockpit.tsx) |
| Cockpit tabs (Financials/Liquidity/Covenants/RV/Debate) | ✅ Exists | [`CreditCockpit.tsx`](../frontend/src/components/cockpit/CreditCockpit.tsx) |
| Charts (AntV G2) | ✅ Financials, Liquidity, RV scatter, Covenant gauges, Debate | `frontend/src/components/cockpit/*` |
| PDF viewer | ⚠️ Renders whole file only — **no highlight, no jump** | [`PDFViewer.tsx`](../frontend/src/components/vault/PDFViewer.tsx) |
| UI store with `pdfPage` + `openPdf(url, page)` | ⚠️ Page field exists but viewer ignores it | [`ui.ts`](../frontend/src/store/ui.ts) |
| Qualitative narrative text | ⚠️ Produced & shown as **plain `<p>`** (rv_commentary, thesis, final_recommendation) | `agent_outputs.py`, `RVScatterPlot.tsx`, `DebateMatrix.tsx` |
| Three-tier evidence data | ✅ **Already modeled**: `EvidenceChain{evidence, risk_mechanic, credit_implication, source_doc}` | [`agent_outputs.py`](../backend/schemas/agent_outputs.py) |
| Global nav / workflow header / execution mesh | ❌ None | — |
| Markdown/MDX rendering | ❌ No `react-markdown`/`mdx` dependency | `frontend/package.json` |
| Inline citation badges / Evidence Sync | ❌ None | — |
| Document-serving API (list docs, presigned URL) | ❌ None | `backend/api/routes/*` |
| Positional source anchors (page/offset/bbox per chunk) | ❌ Chunks store text only; `source_doc` is free-text | [`chunker.py`](../backend/ingestion/rag/chunker.py) |

**Key insight:** the **Evidence → Risk Mechanic → Credit Implication** three-tier lineage the spec asks for is *already the shape of `EvidenceChain`*. The Evidence Trace panel is largely a **rendering + wiring** problem, not a new data model. The hard dependency is **positional anchors** for true click-to-highlight (Section 2).

---

## 2. Backend prerequisites (the critical path)

The frontend cannot "jump to and highlight the exact clause" against anchors that aren't stored. These land **before or alongside** the UI work.

### 2.1 Structured citation anchor (replaces free-text `source_doc`)
Extend `EvidenceChain` ([`agent_outputs.py`](../backend/schemas/agent_outputs.py)) with an optional structured anchor while keeping `source_doc` for display/back-compat:

```python
class SourceAnchor(BaseModel):
    document_id: str          # FK to documents.id
    page: int                 # 1-indexed PDF page
    char_start: int | None = None   # offset into the page's extracted text
    char_end: int | None = None
    quote: str | None = None         # verbatim excerpt for fuzzy re-location
    bbox: list[float] | None = None  # [x0,y0,x1,y1] in PDF user space, if available

class EvidenceChain(BaseModel):
    evidence: str
    source_doc: str                  # keep: human-readable label
    risk_mechanic: str
    credit_implication: str
    anchor: SourceAnchor | None = None   # NEW
    confidence: float | None = None      # NEW: 0–1, drives the "verified/confidence" badge
```

### 2.2 Capture page/offset at ingestion
Today [`pdf_parser.py`](../backend/ingestion/pdf_parser.py) joins all page text and [`chunker.py`](../backend/ingestion/rag/chunker.py) splits on whitespace with no page memory. Change:
- `ingest_pdf` keeps a `(page_number, char_offset)` map while extracting.
- `DocumentChunk.metadata_` gains `page` and `char_start`/`char_end`.
- Add an `embedding`-adjacent column or reuse `metadata_` JSONB for anchors.
- `bbox` is best-effort: `pdfplumber` exposes word boxes (`page.extract_words()`); store them only when cheaply available, otherwise fall back to **quote-based re-location** (search the rendered page text for `quote`).

### 2.3 Inline citation markers in narrative
Agents currently return prose and a *separate* `evidence_chain` array. To render inline badges, the narrative must reference chain entries:
- **Convention:** narrative strings embed `[[cite:<n>]]` markers where `<n>` indexes `material_conclusions[].evidence_chain`. (LLM-friendly, easy to validate, easy to strip.)
- Update the L2–L6 system prompts (e.g. [`cp2_fundamentals.py`](../backend/agents/l2_synthesis/cp2_fundamentals.py), [`cp6e_portfolio_debate.py`](../backend/agents/l6_debate/cp6e_portfolio_debate.py)) to emit markers.
- CP-5 ([`severity_engine.py`](../backend/core/severity_engine.py)) gains a rule: every `[[cite:n]]` must resolve to a real chain entry (dangling citation → WARNING, not a hard block, so the UI degrades gracefully).

### 2.4 Document-serving endpoints (new)
The vault needs real documents to render and anchor against:
- `GET /api/issuers/{id}/documents` → list (`id, doc_type, file_name, fiscal_period, mnpi_flag`).
- `GET /api/documents/{id}/url` → short-lived **presigned MinIO URL** (the viewer fetches the PDF directly; never proxy bytes through the API).
- Both gated by `get_current_user` (consistent with the auth pass already applied).

### 2.5 CP-2B "Downside Pathway" narrative (gap)
The spec references a **CP-2B Downside Pathway** narrative. There is a `CP-2B` prompt at root but **no `CP2B…Output` schema and no DAG node** in [`agent_outputs.py`](../backend/schemas/agent_outputs.py) / [`dag.py`](../backend/agents/orchestration/dag.py). Either: (a) add the CP-2B schema + node, or (b) scope the first narrative release to **CP-2 (Credit Thesis)** and **CP-6E (Debate Rationale)**, which already produce text. **Recommendation: (b) first**, add CP-2B in a later phase.

---

## 3. Frontend architecture

### 3.1 Layout shell (new)

```
<AppShell>
 ├─ <GlobalNavBar>                       // CAOS brand · global search · alerts · user
 │    └─ <AgentExecutionMesh/>           // L0–L6 pipeline status pills (color-coded)
 ├─ <WorkflowStageHeader/>               // Origination · Analysis · Diligence · Committee Prep · Execution
 └─ <Workspace>                          // resizable 40/60 split
      ├─ <SourceVault>                   // LEFT 40%
      │    ├─ <FileTreeSidebar/>         // collapsible; documents per issuer
      │    └─ <PdfViewer/>               // highlight + jump-to-anchor enabled
      └─ <CreditCockpit>                 // RIGHT 60%
           ├─ <CockpitTabs/>             // Dashboard · Analysis · Financials · Covenants …
           ├─ <AnalysisNarrative/>       // L1–L4 narrative w/ sub-headers + inline charts
           └─ <EvidenceTracePanel/>      // Evidence → Risk Mechanic → Credit Implication
```

### 3.2 New / changed components

| Component | New? | Notes |
|---|---|---|
| `GlobalNavBar` | new | Branding, entity search, notifications, user menu. Sticky, 48px. |
| `AgentExecutionMesh` | new | Reads DAG run module statuses; renders L0–L6 pills. |
| `WorkflowStageHeader` | new | 5 stages; Origination shows source-quality + confidence chip. |
| `SourceVault` | new wrapper | Wraps existing `DocumentVault` + adds `FileTreeSidebar`. |
| `FileTreeSidebar` | new | Collapsible; calls `GET /issuers/{id}/documents`. |
| `PdfViewer` | **upgrade** | Add `@react-pdf-viewer` **highlight** + **page-navigation** plugins; consume `pdfPage` + new `highlightTarget` from store. |
| `CockpitTabs` | refactor | Add **Analysis** tab; keep Financials/Covenants/RV/Debate as sub-views. |
| `AnalysisNarrative` | new | Per-agent sub-headers (CP-1…CP-4) + `NarrativeBlock` + adjacent chart. |
| `NarrativeBlock` | new | `react-markdown` renderer with a custom `[[cite:n]]` → `<CitationBadge/>` transform. |
| `CitationBadge` | new | Clickable; on click dispatches a selection event (Section 4). |
| `EvidenceTracePanel` | new | Three-tier lineage cards; verified/confidence badge; "Expand All". |

### 3.3 Dependencies to add
- `react-markdown` + `remark-gfm` (tables/strikethrough). **Not MDX** — MDX executes arbitrary components from model output, an injection risk for LLM-authored text; `react-markdown` with an allow-listed component map is the governed choice.
- `@react-pdf-viewer/highlight` + `@react-pdf-viewer/page-navigation` (stay on the existing `@react-pdf-viewer` stack rather than swapping to `react-pdf-highlighter` — avoids a second PDF engine and the `pdfjs-dist` version it would drag in; see the open pdfjs peer-dep item).
- `react-resizable-panels` (optional) to replace the hand-rolled drag handle with accessible, keyboard-resizable panes.

---

## 4. The core interaction — cross-pane selection ("Evidence Sync")

This is the heart of the spec: a click **anywhere** that represents a data point updates the Evidence Trace panel and (when an anchor exists) the Source Vault.

### 4.1 A single selection store (new)
```ts
// store/selection.ts
interface Selection {
  conclusionId: string | null;     // which MaterialConclusion / data point is focused
  source: "scatter" | "covenant" | "narrative" | "vault" | "trace" | null;
}
interface SelectionStore extends Selection {
  select: (conclusionId: string, source: Selection["source"]) => void;
  clear: () => void;
}
```
Every interactive surface **publishes** the same `conclusionId`; the Evidence Trace panel and PDF viewer **subscribe**. This keeps the panes decoupled — no component calls another directly.

### 4.2 Sequence (worked example from the spec)

```
User clicks the orange TARGET bubble in <RVScatterPlot>
   → selection.select("cp3.subject_spread", "scatter")
      → <EvidenceTracePanel> re-renders that conclusion's evidence_chain
           (Evidence → Risk Mechanic → Credit Implication, + confidence badge)
      → if chain.anchor present:
           ui.openPdf(presignedUrl(anchor.document_id), anchor.page)
           pdf.highlightTarget = { page, quote, bbox }
woven the other direction:
User clicks a highlighted covenant clause in <PdfViewer>
   (highlight areas are pre-seeded from covenant anchors)
      → selection.select("cp4.asset_sale_sweep", "vault")
      → <EvidenceTracePanel> shows that covenant's lineage
      → <CovenantHeadroom> row pulses to the same selection
```

### 4.3 Wiring rules
- Charts attach `conclusionId` to each datum at build time (G2 `element:click` → `select`).
- Covenant grid rows carry `data-conclusion-id`.
- `CitationBadge` calls `select(chainOwnerId, "narrative")`.
- PDF highlight regions are registered from the union of all anchors for the issuer; clicking a region resolves to its `conclusionId`.
- Selection is **idempotent and reversible** — clicking the focused item again (or Esc) calls `clear()`.

---

## 5. Design system & theming

### 5.1 Tokens (Tailwind theme extension + CSS variables)
```
--bg-base:        #0a0a0f   /* app background (spec) */
--bg-panel:       #12121a
--bg-elevated:    #1a1a24
--border:         #262633
--text-primary:   #e6e6ef
--text-muted:     #8a8a9a
--accent:         #4f8cff   /* interactive / focus */
```

### 5.2 Typography
- **UI text:** Inter (already loaded via `next/font` in [`layout.tsx`](../frontend/src/app/layout.tsx)).
- **All numerics, tables, code, citations:** **JetBrains Mono** via `next/font/google`, exposed as `--font-mono`. Apply through a `.tabular` utility (`font-variant-numeric: tabular-nums`) so decimals align in covenant tables, the leverage ladder, and the Evidence Trace values. This is a hard rule for every figure (`5.7x`, `$1.2B`, `388 bps`).

### 5.3 Color discipline — seniority ramp (no banding)
The spec calls out *"eliminate visual banding between secured/unsecured tranches."* Use **distinct hues per seniority class**, not a single-hue lightness ramp (which reads as bands):

| Class | Hue | Token |
|---|---|---|
| 1L Secured (RCF/TLB) | teal | `--tranche-1l:#2dd4bf` |
| 2L Secured (SSN) | blue | `--tranche-2l:#4f8cff` |
| Senior Unsecured | amber | `--tranche-unsec:#f5a524` |
| Subordinated | violet | `--tranche-sub:#a855f7` |
| Equity | slate | `--tranche-eq:#64748b` |

Severity stays orthogonal: `OK #22c55e · WARNING #f5a524 · CRITICAL #ef4444` (matches `CovenantHeadroom.severity`). Pipeline-mesh status: `IDLE #3f3f46 · RUNNING #4f8cff(pulse) · PASS #22c55e · WARNING #f5a524 · BLOCKED/FAILED #ef4444`.

### 5.4 Motion
- 150–200ms `ease-out` on hover/selection; selected cards get a 1px accent ring + subtle elevation.
- `RUNNING` mesh pills use a slow opacity pulse (`prefers-reduced-motion` disables it).
- Pane drag uses transform-only updates (no layout thrash).

---

## 6. Stage → Agent mesh mapping

The **WorkflowStageHeader** and **AgentExecutionMesh** are two views of the same DAG state ([`dag.py`](../backend/agents/orchestration/dag.py)). Status is derived from `GET /api/agents/runs/{id}/outputs` (per-module `status`/`severity`).

| Stage (header) | Mesh layer | Modules | Surfaces |
|---|---|---|---|
| **Origination** | L0 | CP-0 readiness (+ source quality, **confidence score**) | gate chip in header |
| **Analysis** | L1–L2 | CP-1, CP-1A, CP-2 | Analysis tab narrative + Financials |
| **Diligence** | L3–L4 | CP-3, CP-4, CP-4C (+ CP-2B downside) | Covenants, RV, Liquidity |
| **Committee Prep** | L5 | CP-5, CP-5B governance/traceability | Evidence Trace integrity badges |
| **Execution** | L6 | CP-6E portfolio debate / sizing | Debate tab + final recommendation |

(The code's layer dirs are L1–L6 + orchestration; the header's 5 business stages collapse L5/L6 governance+debate under Committee Prep/Execution. The mesh shows the finer L0–L6 granularity.)

---

## 7. Phased delivery plan

Each phase is independently shippable; backend anchor work (F2) is the long pole.

| Phase | Deliverables | Testing |
|---|---|---|
| **F1 — Shell & chrome** | `GlobalNavBar`, `WorkflowStageHeader`, `AgentExecutionMesh` (wired to DAG outputs); theme tokens + JetBrains Mono. No new data. | Unit: stage/mesh status mapping from a mock `AgentOutput[]`. |
| **F2 — Source anchors (backend)** | `SourceAnchor` schema, ingestion page/offset capture, `[[cite:n]]` marker convention + CP-5 validation rule, doc-list + presigned-URL endpoints. | Unit: chunk→page mapping; citation-marker resolver; **malformed `[[cite:…]]` never throws** (degrades to plain text). |
| **F3 — Narrative blocks** | `NarrativeBlock` (`react-markdown` + allow-listed components), `CitationBadge`, Analysis tab with per-agent sub-headers + adjacent charts (CP-2 thesis, CP-6E rationale). Citations render but are display-only. | Unit: markdown parser fuzz (unterminated/duplicate/out-of-range citation strings render safely). |
| **F4 — Evidence Trace panel** | `EvidenceTracePanel` three-tier cards + confidence/verified badge + Expand All, reading from `evidence_chain`. | Unit: lineage render for conclusions with 0/1/N chain entries. |
| **F5 — Cross-pane selection** | `selection` store; wire scatter bubbles, covenant rows, citation badges, and trace cards to a shared `conclusionId`. | E2E (Playwright): click target bubble → trace updates; click covenant row → trace updates. |
| **F6 — Evidence Sync to PDF** | Upgrade `PdfViewer` with highlight + page-navigation plugins; clicking a citation/clause jumps + highlights via the anchor (quote-fallback when no bbox); collapsible file tree. | E2E (Playwright): **click an inline text citation → PDF viewer scrolls to page and highlights the source paragraph** (the spec's acceptance test). |

### 7.1 Explicit testing requirements (from the spec)
- **Markdown safety unit tests** — malformed citation strings from the LLM (`[[cite:]]`, `[[cite:99]]`, nested brackets, unicode) must never break rendering; they fall back to inert text.
- **Playwright E2E** — (1) click an inline citation badge → assert the PDF viewer page changed and a highlight layer is present; (2) click the orange target bubble → assert the Evidence Trace panel shows the matching `conclusionId` lineage.
- Extend the existing harness ([`upload_flow.spec.ts`](../tests/frontend/e2e/upload_flow.spec.ts), [`playwright.config.ts`](../frontend/playwright.config.ts)).

---

## 8. Risks & open decisions

1. **bbox availability.** Not all PDFs yield reliable word boxes (scanned OMs). Mitigation: quote-based re-location as the default; bbox as an enhancement. Decide whether to OCR scanned docs (affects ingestion scope).
2. **Citation marker authorship.** Relies on agents emitting `[[cite:n]]` reliably. Mitigation: CP-5 WARNING + UI graceful-degradation; do **not** hard-block a run on a dangling citation.
3. **PDF engine lock-in.** Staying on `@react-pdf-viewer` assumes its highlight plugin meets the "highlight exact paragraph" bar; spike F6 early. (Also unblock the existing `pdfjs-dist` peer-dep conflict first — it currently forces `--legacy-peer-deps`.)
4. **CP-2B scope.** Confirm whether Downside Pathway narrative is in this milestone or deferred (Section 2.5).
5. **JWT-in-localStorage** remains the known auth tradeoff; presigned URLs (F2) keep document bytes off the API and out of that surface.

---

## 9. Definition of done (this milestone)

- Analyst opens an issuer → sees the **5-stage header** and a **live L0–L6 mesh**.
- **Analysis tab** shows the CP-2 credit thesis and CP-6E debate rationale as governed markdown with **inline citation badges**.
- Clicking a **citation badge**, an **orange target bubble**, or a **covenant clause** drives a single shared selection that updates the **Evidence Trace panel** (Evidence → Risk Mechanic → Credit Implication) and, where an anchor exists, **jumps + highlights** the clause in the Source Vault.
- All figures render in **JetBrains Mono** with aligned decimals; tranche colors are **categorically distinct**; interactions have hover/selection transitions.
- Unit + Playwright suites green, including the malformed-citation and click-to-highlight cases.
