#!/usr/bin/env python
"""Live smoke test for the Gemini provider adapter (engine/gemini.py).

Checks the items that CANNOT be verified in the mocked offline suite — they need a
real GEMINI_API_KEY and a network call:

  A. text lane    — a plain system+message call returns text + populated usage
                    (confirms usage_metadata token fields are read correctly).
  B. forced-tool  — the REAL synth schema (synth._PAYLOAD_TOOL: closed enums,
                    nested claims/evidence) is accepted by Gemini's
                    parameters_json_schema, and a forced call yields a tool_use
                    block whose .input is a parsed dict with stop_reason tool_use
                    (the synth lane's contract).

Run from caos/server with a Gemini-capable venv (prod parity = .venv311):

    GEMINI_API_KEY=…  ./.venv311/bin/python scripts/smoke_gemini.py

Exit 0 = both checks pass. A failure prints the exact error — e.g. a 400
INVALID_ARGUMENT on check B means the synth schema needs translation for Gemini
(the synth lane's text-block JSON fallback still covers production). Makes a small
number of real (billable) Gemini calls.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # caos/server on path

from config import get_settings  # noqa: E402
from engine import gemini, synth  # noqa: E402


def _ok(label: str, cond: bool, detail: str = "") -> bool:
    print(f"  [{'PASS' if cond else 'FAIL'}] {label}{(' — ' + detail) if detail else ''}")
    return cond


async def _text_lane(model: str) -> bool:
    print(f"\nA. text lane  (model={model}, effort=minimal)")
    try:
        resp = await gemini.call(
            model=model, system="You are a terse credit analyst.",
            messages=[{"role": "user", "content": "Reply with the single word: OK"}],
            max_tokens=64, effort="minimal",
        )
    except Exception as e:  # noqa: BLE001
        return _ok("call", False, f"{type(e).__name__}: {e}")
    text = next((b.text for b in resp.content if b.type == "text"), "")
    u = resp.usage
    return all([
        _ok("returned text", bool(text), repr(text[:60])),
        _ok("usage populated", u.input_tokens > 0 and u.output_tokens > 0,
            f"in={u.input_tokens} out={u.output_tokens} cache_read={u.cache_read_input_tokens}"),
        _ok("stop_reason set", bool(resp.stop_reason), resp.stop_reason),
    ])


async def _forced_tool_lane(model: str) -> bool:
    print(f"\nB. forced-tool lane  (model={model}, real synth _PAYLOAD_TOOL)")
    system = ("Emit this module's payload via the tool. Source: 'ACME 1L term loan; "
              "net leverage 4.2x as of Q4; covenant: max total leverage 6.0x.'")
    try:
        resp = await gemini.call(
            model=model, system=system,
            messages=[{"role": "user", "content": "Produce the module payload now."}],
            max_tokens=2048, effort="low",
            tools=[synth._PAYLOAD_TOOL],
            tool_choice={"type": "tool", "name": synth._PAYLOAD_TOOL["name"]},
        )
    except Exception as e:  # noqa: BLE001 — a 400 INVALID_ARGUMENT here = schema not accepted
        return _ok("call (schema accepted)", False, f"{type(e).__name__}: {e}")
    tool_blocks = [b for b in resp.content if b.type == "tool_use"]
    has_dict = bool(tool_blocks) and isinstance(tool_blocks[0].input, dict) and bool(tool_blocks[0].input)
    return all([
        _ok("schema accepted (no 400)", True),
        _ok("tool_use block returned", len(tool_blocks) == 1),
        _ok("tool .input is a populated dict", has_dict,
            ",".join(sorted(tool_blocks[0].input)[:8]) if tool_blocks else ""),
        _ok("stop_reason == tool_use", resp.stop_reason == "tool_use", resp.stop_reason),
    ])


async def main() -> int:
    if not os.environ.get("GEMINI_API_KEY") and not get_settings().gemini_api_key:
        print("GEMINI_API_KEY not set. Run:\n"
              "    GEMINI_API_KEY=…  ./.venv311/bin/python scripts/smoke_gemini.py")
        return 2
    s = get_settings()
    print(f"Gemini smoke test — cheap={s.model_tier_cheap}  strong={s.model_tier_strong}")
    a = await _text_lane(s.model_tier_cheap)
    b = await _forced_tool_lane(s.model_tier_strong)
    print(f"\n{'ALL PASS' if (a and b) else 'FAILURES ABOVE'} — text:{a} forced-tool:{b}")
    return 0 if (a and b) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
