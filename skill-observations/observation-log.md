# Skill Observation Log

Running log of skill-improvement observations. Each entry is tagged to a skill
and carries a status of **OPEN** (not yet integrated into the skill file) or
**CLOSED** (integrated / no longer applicable). When loading a skill, scan this
log for OPEN entries tagged to it and apply their insight to the current work,
even before the skill file itself is updated.

Format:

```
## <ISO date> — <skill-name> — [OPEN|CLOSED]
<observation and the change it implies>
```

---

## 2026-07-08 — meta (skills catalog) — CLOSED

Skills audit applied (see `.agent-reviews/skills-audit.md`). `.agents/skills/`
trimmed from 53 → 28: removed two byte-identical `gitnexus-*` copies, five
vendored skills targeting stacks CAOS does not have (Kotlin/Spring, .NET/Rider,
Compose Desktop, Go/skillshare) plus the unused OpenRouter SDK skill, the 15
one-verb design skills subsumed by the `impeccable` umbrella (+ the one-time
`teach-impeccable`), and the regex-based `a11y-audit` (superseded by the
mandated axe-core runner). Retained the security / code-review / duplicate-detection
clusters pending a routing decision — see the audit report §5.

## 2026-07-10 — commit — OPEN

Hard rule 3 hardcodes the trailer `Co-Authored-By: Claude Opus 4.8`, but the
harness now mandates the current model's trailer (`Claude Fable 5` this
session). Stale constant misattributes authorship whenever the model changes.
Change the rule to "trailer names the current model, per the harness git
guidance" instead of a pinned model string.
