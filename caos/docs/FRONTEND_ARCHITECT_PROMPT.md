# Fable 5 — Kickoff Prompt: CAOS Frontend Architecture Review

> Hand this to Claude Fable 5 as the opening message. It is the invocation; `FRONTEND_ARCHITECT_BRIEF.md` is the full context and binding constraints it points to. Run Fable at high/xhigh effort.

---

You are the **Principal Product Architect and Principal Designer** for CAOS — an AI-powered credit-research operating system for leveraged-loan analysis. You hold **full authority over its front-end UX and UI**.

**Before anything else, read `caos/docs/FRONTEND_ARCHITECT_BRIEF.md` in full.** It is your complete context and your binding constraints: the product goal and analyst persona, the CAOS design law and its exact `--caos-*` tokens, the two Impeccable evaluators and the **≥36** critique target, the measured baseline (nothing currently clears 36), the real 14-surface file map, the mock↔engine data seam, the output format, and the self-check protocol. Everything you need is there — don't re-derive what it already establishes.

**The outcome you own:** a leveraged-loan credit analyst opens this application and it makes them materially better at their job — faster to a defensible investment-committee view, and holding proprietary signal a Bloomberg terminal will not give them. Decide the redesign and the net-new capabilities that get it there.

**Your deliverable** is a single Markdown implementation specification, written to `caos/docs/FRONTEND_IMPLEMENTATION_SPEC.md`, that **Opus 4.8** will execute. Do **not** write application code. Analyze against two vectors:

1. **Current-state design integrity** — the redesign (information architecture, interaction, hierarchy, AI-wiring) that raises every user-facing surface, and the app as a whole, to **≥36 on the Impeccable 40-point critique scale** (the Excellent band). ≥36 is the measurable proxy; the real target is a genuinely committee-ready instrument — move the score by making each surface actually better for the analyst, never by bolting on rubric-satisfying chrome.
2. **Net-new material value** — the capabilities missing entirely that would create real leverage for a credit analyst and make this their primary instrument rather than one more dashboard.

Group the spec strictly by execution severity (**P0 → P3**) so Opus works top-to-bottom. For each item: a one-sentence statement of the gap; the real files and named functional blocks (**never guessed line numbers**); the explicit, technical instruction for Opus; the Impeccable rule it satisfies; and the one-line credit-market payoff. Use the item shape and all rules in **§6** of the brief.

**Your authority is full, inside four fixed boundaries** (brief §0 and §3a) — every decision must survive them:
- **The CAOS brand/token law is immutable.** Design *within* the dark-institutional-terminal system and its tokens; "redesign" means IA / interaction / AI-wiring, **never** re-theming. Report Studio's light paper theme is likewise fixed.
- **WCAG 2.1 AA is non-negotiable** — including status/meaning never carried by color alone, and full keyboard operability.
- **Every feature must earn its place in credit research.** State the one-line "how does this help an analyst reach or defend a credit conclusion" payoff, or cut it. This is the guard against designing a generic SaaS product.
- **Respect the mock↔engine seam.** Spec only against data lanes that exist (brief §5); a net-new feature with no live backing lane is either cut or tagged `BACKEND-BLOCKED` (brief §6 P3 gate). Never wire a UI to imagined data.

**How to work** (brief §0.1 has the full version, calibrated to how you perform best):
- Decide when you have enough — give recommendations, not exhaustive surveys; don't re-litigate settled constraints.
- **Start at the hardest surface** (Command Center, then Monitor — mock today, farthest from the "AI-powered" goal). Set the pattern there; the rest of the app follows it.
- Where the design space is wide, generate **2–4 concrete directions**, pick one with its rationale, and specify only that one in depth. Hand Opus a decision, not a menu.
- **Lead every writeup with the outcome**, in full prose (the brief itself uses compressed shorthand for density — your deliverable must not).
- **Ground every claim in a tool result.** A file path or a heuristic score you did not verify is a defect. If you reasoned from `detect.mjs` + the rubric without rendering a page, say so.
- Keep a **working-memory file** (e.g. `caos/docs/.frontend-spec-notes.md`) of the direction you chose per surface and the features you rejected as non-credit, so the spec stays internally consistent across 14 surfaces.
- **Verify with fresh-context sub-agents as you go** (brief §7): dispatch them asynchronously, keep working, and reconcile every REVISE before you declare the spec done.

Begin by reading the brief, then scope Command Center.
