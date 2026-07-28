# CP-EMAIL F — Digest and Follow-ups

## Required display

Display the complete run in this order:

1. **Run header:** mode, as-of timestamp/time zone, lookback, resolved scope, markets and minimum level.
2. **Coverage strip:** every requested mailbox/public source class with status, access depth and limitation.
3. **Top-line assessment:** counts by priority and the leading cross-cutting conclusion; use a zero-item statement when applicable.
4. **Ranked story cards:** all `URGENT ACTION`, then `MATERIAL SIGNAL`, `WATCH` and `INFORMATION` cards up to the cap; assign stable `item-N` handles once for the run.
5. **Sector/CLO/regulatory synthesis:** only when it passes the synthesis gate.
6. **Recommended analyst actions:** manual next steps, questions and dates; optional RBOT commands.
7. **Limitations:** inaccessible content, unresolved identities/conflicts, comparison-basis gaps, stale coverage and reliable suppressed count or `—`.

No section is satisfied by a file link. The digest is displayed in the current chat and creates no Markdown, Word, JSON, dashboard, newsletter or handoff artifact.

## Card discipline

Use the card contract in `SCHEMA_REFERENCE.md`. Keep headline and explanation concise, but never omit the credit mechanism, confidence reason or source locator for a material item. State `What is new: NOT TESTED — prior comparison basis unavailable` when applicable.

Every source citation includes source/publication, timestamp and retrievable link or mailbox locator available to the user. Attribute private commentary as commentary. Do not expose unrelated recipients or reproduce proprietary text. A material figure without a complete locator is omitted or marked `[Insufficient Information]`.

## Caps and diversity

Default `max_items` is 15; `Full Digest` defaults to 30. Urgent items are never hidden by the cap. After urgent preservation, prevent one prolific sender, issuer or duplicated evidence family from crowding out higher-value breadth. If a reliable candidate count exists, show the suppressed count and offer conversational continuation; otherwise render `—` rather than estimate.

## Zero-item and partial-coverage runs

A zero-item run is valid only when it still displays the full scope and coverage strip, states that no qualifying items were found under the applied gate, and lists limitations. Do not say `no news` when sources were unavailable or only partially accessible.

Partial source availability does not block accessible-source analysis. Qualify the top-line conclusion and each affected story rather than implying full-market coverage.

## Conversational follow-ups

The original story rank and `item-N` are immutable handles for the run. Support:

- `Expand item 3` — show atomic claims, mechanism, conflicts and limitations.
- `Show the evidence for item 3` — show source roles, access depth, timestamps and locators.
- `Why was item 6 below item 8?` — explain ordinal tie-breaks and penalties.
- `Show only MATERIAL SIGNAL and URGENT ACTION` — filter the existing digest.
- `Group by sector` — reorganise existing cards without changing classification.
- `What changed?` — answer only from the disclosed comparison basis.
- `What are the CLO implications?` — require facility/ratings/eligibility evidence or state the gap.
- `Which RBOT module should follow?` — recommend manually; never run it.

`Expand`, `show evidence`, `explain rank`, `filter`, `group`, and implication questions answered solely from the existing run are **view operations**. They do not retrieve, reclassify, renumber or create a new run; every card keeps its original `item-N` and rank even when some cards are hidden or regrouped.

A request that changes issuer/sector/market scope, source class, lookback, as-of/cut-off, inclusion/exclusion terms, or asks for information newer than the run is a **new run**. State that distinction, create a new run ID, perform the full seven phases and assign new ranks. Do not imply that either a view or a new run was saved, delivered or persisted.
