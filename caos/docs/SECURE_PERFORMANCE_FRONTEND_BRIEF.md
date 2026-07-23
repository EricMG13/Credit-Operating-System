# Brief — Secure Performance Frontend blueprint

**Target model:** Claude Fable 5 (`claude-fable-5`)
**Recommended effort:** `xhigh` — security-boundary + cross-tree performance architecture with adversarial self-verification; a wrong "bundle is clean" call has real cost.

---

## Mission prompt

I'm hardening the CAOS frontend — an institutional leveraged-finance credit workspace (Next.js 16 + FastAPI) — ahead of a production deploy. Analysts work in dense, numbers-heavy views and real money rides on a wrong read, so two properties are non-negotiable: no upstream AI or database credential may reach the browser bundle, and the workspace must hold 60fps while rendering large datasets. The output of this task is a blueprint that will be handed to Claude Fable 5 to execute, so it must be precise enough to act on without re-deriving your analysis. With that in mind:

Produce a single Markdown blueprint — "Secure Performance Frontend" — that Fable 5 can implement directly. Analyze the frontend codebase, environment configuration, component render tree, and data-fetching hooks, then design the changes across three objectives:

1. **BFF proxy layer.** Find every raw API key or infrastructure token currently reachable from client code or the browser bundle (LLM keys, vector-store keys, DB credentials). Design cookie-authenticated, server-side proxy routes that attach those tokens on the backend before forwarding to external LLMs and vector stores. For each route, specify the explicit request/response schema, the auth check, and the exact credential it moves server-side.

2. **Atomic state subscriptions.** Identify the global contexts that trigger app-wide render waterfalls. Specify a refactor to atomic slices or signals so a component re-renders only when its own data mutates. Give the exact slice patterns to deploy and the contexts each one replaces.

3. **Windowed rendering.** Identify the dense DOM layouts (financial ledgers, covenant monitoring sheets, large tables) that bottleneck rendering, and specify the list-virtualization boundaries: which components, which lists, and the active-node budget for each.

The blueprint is done when it names the specific component file paths that bottleneck rendering, gives explicit schemas for every server-side proxy route, and states the exact state-slice patterns to deploy — concrete enough that Fable 5 implements from it without guessing. The deliverable is the blueprint; don't rewrite the components yourself, don't design beyond what these three objectives require, and don't add handling for cases that can't occur.

Establish a method for checking your own work at an interval of each core dashboard route as you build the blueprint. For every route, run a fresh-context verifier subagent against two questions: (a) do the proposed changes leave any AI or database token reachable from the browser bundle, and (b) does any performance optimization re-expose a secret you moved server-side? Fresh-context verifiers catch what self-critique misses. Delegate independent route analyses to subagents and keep working while they run; intervene if one goes off track or is missing context.

Before reporting any finding, audit it against an actual tool result from this session — a grep of the built bundle, a file you read, a route you traced. Report only what you can point to evidence for; if a token's exposure is not yet verified, say so. Don't state that the bundle is clean until a subagent has confirmed it.

You are operating autonomously. The user is not watching in real time and cannot answer questions mid-task, so asking "Want me to…?" will block the work. For reversible analysis and design that follow from this request, proceed without asking. Before ending your turn, check your last paragraph: if it is a plan, a question, or a promise about work you have not done, do that work now with tool calls. End your turn only when the blueprint is complete or you are blocked on input only the user can provide. Open the final summary with the outcome in one sentence, then the detail.
