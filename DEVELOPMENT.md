# Development

This document covers *how* SynthFinder is built — the AI-assisted workflow and
the supporting artifacts in this repo. The application itself is a conventional
TypeScript / Next.js monorepo; for what it does and how to run it, see the
[README](./README.md), and for architecture see [CLAUDE.md](./CLAUDE.md) and the
[ADRs](./adr/).

## AI-assisted workflow

SynthFinder is developed with [Claude Code](https://claude.com/claude-code) as a
pair-programming partner, under an Extreme Programming (XP) discipline:

- **Test-driven development** — behaviour is specified by tests first; the suite
  (`npm test`) is the regression safety net that makes aggressive refactoring safe.
- **Small, atomic commits** — each commit leaves the codebase in a working state
  with its tests passing.
- **Decisions recorded as ADRs** — significant choices are written down in
  [`adr/`](./adr/) rather than living only in chat history.

The artifacts below are *development tooling*, not application code. They exist to
make the codebase legible to both humans and LLMs — treat them the way you'd treat
any other part of the toolchain (linters, CI config, editor settings).

| Path | What it is |
|------|------------|
| [`adr/`](./adr/) | Architecture Decision Records — the "why" behind each significant choice. |
| [`CLAUDE.md`](./CLAUDE.md) | Top-level orientation for an LLM working in the codebase (structure, commands, conventions). |
| [`docs/agents/`](./docs/agents/) | Conventions for AI agents — issue tracker, triage labels, and domain-doc pointers. |
| [`docs/plans/`](./docs/plans/) | Design notes and implementation plans for each slice of work. |
| [`skill/valuing-vintage-synths/`](./skill/valuing-vintage-synths/) | An [Anthropic Agent Skill](https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/overview) holding seed synth-valuation knowledge (see below). |
| [`evals/`](./evals/) | Eval suites that exercise the LLM-dependent stages (`npm run eval`). |

## Knowledge source

The synth-valuation knowledge is decoupled from the code: the agent references a
configured knowledge source by ID (`ANTHROPIC_SKILL_ID`), not hard-coded content.
The files committed under `skill/valuing-vintage-synths/` are a small **seed**
corpus — enough to build, test, and demo the pipeline. The curated, in-depth
corpus is maintained privately, with retrieval moving to a RAG-backed store over
time. The point: the engine is open; the domain knowledge is pluggable.

## Local development

See the [README](./README.md) for the full command table. The essentials:

```bash
npm install
npm run dev    # web UI at http://localhost:3000
npm test       # Vitest across all packages
npm run scan   # the deal-scanner CLI
```

Run with `MARKETPLACE=fixture` (the default) and `LLM_MODE=stub` to work entirely
offline — no API keys, no network calls — using canned listings and deterministic
scoring.
