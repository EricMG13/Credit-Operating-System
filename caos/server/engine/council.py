"""CP-5C: semantic committee review — an ensemble *finding producer*.

Where CP-5B ([lineage.py]) checks that evidence traces resolve (structure),
CP-5C checks the reasoning: does each figure follow from its cited evidence, is
the covenant read defensible, is anything material missing. It does NOT decide
status — it emits ``Finding`` objects that the deterministic CP-5 gate
([gate.py]) consumes, exactly like ``validate_lineage``. An LLM still never
declares its own output committee-ready.

Diversity comes from review *lens*, not vendor: a small panel of adversarial
"seats" runs concurrently against one (single-vendor) model, each mapped to a
CP-5 audit lane. The "chairman" is a deterministic dedup (``_merge``), not an
arbiter — synthesis must never soften the gate.

An optional Stage-2 peer round (``council_peer_round``) mirrors karpathy's
llm-council: the pooled findings are shown back to the panel with authorship
stripped, each seat confirms/rejects and recalibrates severity, and a
deterministic tally (``_tally_votes``) drops the ones the panel majority
rejects. It only ever *filters and recalibrates* findings — never invents them,
never decides status.

Two implementations behind one interface, mirroring the demo-mode pattern in
[synth.py]:

  - FixtureReviewer — emits no findings, fully offline. Used when no model key
    is configured or the council is disabled, so the engine stays testable.
  - LiveReviewer — fans the produced payloads out to each seat via Claude and
    parses the findings.

``get_reviewer`` picks Live only when ``council_enabled`` and a key are set.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import asdict, dataclass, replace
from typing import Dict, List, Sequence

from config import get_settings
from engine.gate import SEVERITY_RANK, Finding
from engine.schemas import ModulePayload

logger = logging.getLogger("caos.engine")


@dataclass(frozen=True)
class Seat:
    """One reviewer lens. ``lane`` is the CP-5 audit lane the findings carry."""

    lane: int
    name: str
    lens: str  # the adversarial instruction that makes this seat distinct


# Semantic lanes 2-5. Structural lanes (1 unsupported, 6 evidence-trace,
# 7 gate) belong to CP-5B; the council does not collide with them.
SEATS: Sequence[Seat] = (
    Seat(2, "NumericalConsistency",
         "Recompute every ratio and figure from the cited evidence. Flag any "
         "number that does not follow, any unit or scale error, and any add-back "
         "the source does not support."),
    Seat(3, "CovenantConstruction",
         "Read each covenant and definition strictly against the agreement "
         "language. Flag interpretations the text does not support and missed "
         "baskets or carve-outs."),
    Seat(4, "EvidenceSufficiency",
         "For each material claim, judge whether the cited evidence is sufficient "
         "and on-point. Flag conclusions that outrun their support."),
    Seat(5, "DevilsAdvocate",
         "Argue the bear case the analyst skipped. Flag material omissions, "
         "optimistic framing, and single-source risk."),
)


class FixtureReviewer:
    """No-op reviewer — the engine runs identically, just without a council."""

    name = "fixture"

    async def review(self, produced: Sequence[ModulePayload]) -> List[Finding]:
        return []


class LiveReviewer:
    name = "live"

    def __init__(self) -> None:
        self._settings = get_settings()
        self._client = None

    def _get_client(self):
        if self._client is None:
            import anthropic

            self._client = anthropic.AsyncAnthropic(api_key=self._settings.anthropic_api_key)
        return self._client

    async def review(self, produced: Sequence[ModulePayload]) -> List[Finding]:
        if not produced:
            return []
        seats = list(SEATS[: max(0, self._settings.council_seats)])
        if not seats:
            return []
        # Concurrent fan-out, one call per seat (mirrors query_models_parallel).
        # return_exceptions so one seat failing never blocks the gate.
        batches = await asyncio.gather(
            *(self._seat_review(seat, produced) for seat in seats),
            return_exceptions=True,
        )
        findings: List[Finding] = []
        for seat, batch in zip(seats, batches):
            if isinstance(batch, Exception):
                logger.warning("council seat %s failed: %s", seat.name, batch)
                continue
            findings.extend(batch)
        merged = _merge(_attribute(findings, produced))
        if self._settings.council_peer_round and merged:
            merged = await self._peer_round(merged, produced, seats)
        return merged

    async def _seat_review(self, seat: Seat, produced: Sequence[ModulePayload]) -> List[Finding]:
        system = (
            f"You are the {seat.name} reviewer on a credit investment committee. "
            f"{seat.lens}\n\nReturn ONLY a JSON array of findings, each an object "
            "{severity, module_id, affected_claim_id, description, "
            "required_remediation}. severity is one of CRITICAL, MATERIAL, MINOR. "
            "Cite the module_id and claim_id you object to. Return an empty array "
            "[] if the work is sound. Never invent figures; judge only what the "
            "payloads contain."
        )
        user = json.dumps([asdict(p) for p in produced], default=str)
        resp = await self._get_client().messages.create(
            model=self._settings.anthropic_model,
            max_tokens=2048,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = next((b.text for b in resp.content if b.type == "text"), "[]")
        return _parse(seat, text)

    async def _peer_round(
        self, merged: List[Finding], produced: Sequence[ModulePayload], seats: List[Seat]
    ) -> List[Finding]:
        """Stage 2: show the pooled findings back to the panel, authorship hidden,
        and let each seat confirm/reject + recalibrate. Deterministic tally."""
        labels = [chr(65 + i) for i in range(len(merged))]  # A, B, C, … (anonymous)
        catalog = "\n".join(
            f"Finding {lbl}: [{f.module_id} {f.affected_claim_id or '-'}] "
            f"severity={f.severity} — {f.description}"
            for lbl, f in zip(labels, merged)
        )
        ballots = await asyncio.gather(
            *(self._vote(seat, catalog, produced) for seat in seats),
            return_exceptions=True,
        )
        valid = []
        for seat, b in zip(seats, ballots):
            if isinstance(b, Exception):
                logger.warning("council peer vote %s failed: %s", seat.name, b)
                continue
            valid.append(b)
        return _tally_votes(merged, valid)

    async def _vote(
        self, seat: Seat, catalog: str, produced: Sequence[ModulePayload]
    ) -> Dict[str, dict]:
        system = (
            "You are a member of a credit investment committee performing BLIND "
            "peer review. Below are candidate findings raised by the committee "
            "with authorship hidden. For each, judge only whether it is a valid, "
            "material objection to the analytical payloads — not who raised it.\n\n"
            "Return ONLY a JSON object mapping each finding label to "
            "{keep: true|false, severity: CRITICAL|MATERIAL|MINOR}. keep=false "
            "means the objection is wrong or immaterial. Do not add findings."
        )
        user = (
            "PAYLOADS:\n" + json.dumps([asdict(p) for p in produced], default=str)
            + "\n\nCANDIDATE FINDINGS:\n" + catalog
        )
        resp = await self._get_client().messages.create(
            model=self._settings.anthropic_model,
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = next((b.text for b in resp.content if b.type == "text"), "{}")
        return _parse_ballot(text)


def _parse_ballot(text: str) -> Dict[str, dict]:
    """Parse a peer-vote response into {label: {keep, severity}} (defensive)."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return {}
    return {str(k): v for k, v in data.items() if isinstance(v, dict)}


def _tally_votes(findings: List[Finding], ballots: Sequence[Dict[str, dict]]) -> List[Finding]:
    """Aggregate blind peer votes. Conservative for a risk gate: a finding is
    dropped only when the panel *majority* rejects it (ties keep); severity is
    recalibrated to the most severe surviving vote, never below the original."""
    labels = [chr(65 + i) for i in range(len(findings))]
    out: List[Finding] = []
    for label, f in zip(labels, findings):
        keeps, rejects, voted_sevs = 0, 0, []
        for ballot in ballots:
            vote = ballot.get(label)
            if not isinstance(vote, dict):
                continue
            if bool(vote.get("keep", True)):
                keeps += 1
                sev = str(vote.get("severity", "")).upper()
                if sev in SEVERITY_RANK:
                    voted_sevs.append(sev)
            else:
                rejects += 1
        if rejects > keeps:
            continue  # panel majority rejected -> drop (noise reduction)
        if voted_sevs:
            top = max(voted_sevs, key=lambda s: SEVERITY_RANK[s])
            if SEVERITY_RANK[top] > SEVERITY_RANK[f.severity]:
                f = replace(f, severity=top)  # peers escalated; never de-escalate
        out.append(f)
    return out


def _parse(seat: Seat, text: str) -> List[Finding]:
    """Parse a seat's JSON array into Findings (defensive; bad output -> none)."""
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        return []
    try:
        items = json.loads(match.group(0))
    except json.JSONDecodeError as e:
        logger.warning("council seat %s returned unparseable JSON: %s", seat.name, e)
        return []
    findings: List[Finding] = []
    for i, d in enumerate(items if isinstance(items, list) else []):
        if not isinstance(d, dict):
            continue
        severity = str(d.get("severity", "")).upper()
        if severity not in SEVERITY_RANK:  # never let a seat invent a severity
            severity = "MINOR"
        findings.append(Finding(
            finding_id=f"CP-5C-{seat.lane}-{i}",
            severity=severity,
            lane=seat.lane,
            description=str(d.get("description", "")).strip() or f"{seat.name} finding",
            module_id=(str(d["module_id"]) if d.get("module_id") else None),
            affected_claim_id=(str(d["affected_claim_id"]) if d.get("affected_claim_id") else None),
            required_remediation=(
                str(d["required_remediation"]) if d.get("required_remediation") else None),
        ))
    return findings


def _attribute(findings: Sequence[Finding], produced: Sequence[ModulePayload]) -> List[Finding]:
    """Pin each finding to a real produced module so the CP-5 gate can act on it.

    The gate attributes findings to modules by ``module_id``; a hallucinated or
    missing id would make a finding inert. Keep findings whose id is real; when a
    seat omits the id and exactly one module was produced, assign it; otherwise
    drop (and log) — an unattributable finding cannot gate anything.
    """
    known = {p.module_id for p in produced}
    sole = next(iter(known)) if len(known) == 1 else None
    kept: List[Finding] = []
    for f in findings:
        if f.module_id in known:
            kept.append(f)
        elif sole is not None:
            kept.append(Finding(
                finding_id=f.finding_id, severity=f.severity, lane=f.lane,
                description=f.description, module_id=sole,
                affected_claim_id=f.affected_claim_id,
                required_remediation=f.required_remediation,
            ))
        else:
            logger.warning(
                "dropping council finding with unknown module_id %r", f.module_id)
    return kept


def _merge(findings: Sequence[Finding]) -> List[Finding]:
    """Chairman-as-dedup: collapse seats that flagged the same claim, keeping the
    worst severity. Deterministic on purpose — the gate, not an LLM, decides."""
    best: Dict[tuple, Finding] = {}
    for f in findings:
        key = (f.module_id, f.affected_claim_id, f.lane)
        cur = best.get(key)
        if cur is None or SEVERITY_RANK[f.severity] > SEVERITY_RANK[cur.severity]:
            best[key] = f
    return list(best.values())


def get_reviewer():
    """Live only when the council is enabled and a key is set; else the no-op."""
    s = get_settings()
    if s.council_enabled and s.anthropic_api_key:
        return LiveReviewer()
    return FixtureReviewer()
