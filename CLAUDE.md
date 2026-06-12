# CLAUDE.md

This is the top-level guide for LLMs working in the synthfinder-agent codebase.

## Project Overview

SynthFinder is an AI-powered deal-finding agent for synthesizer marketplaces. It's structured as an npm workspaces monorepo with three packages:

- **`@synthfinder/shared`** (`packages/shared/`) — Domain types and interfaces
- **`@synthfinder/mcp-server`** (`packages/mcp-server/`) — MCP server for marketplace data access
- **Agent** (`packages/agent/`) — Next.js App Router project with CLI entry point and web UI

See [ADR-009](./adr/009-monorepo-workspaces.md) for the monorepo rationale.

## Commands

All commands are run from the repository root:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server (agent package) |
| `npm run build` | Build Next.js app |
| `npm test` | Run Vitest across all packages |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier (write) |
| `npm run format:check` | Prettier (check only) |
| `npm run type-check` | `tsc --build` (project references) |
| `npm run scan` | Run the deal scanner CLI |

## Architecture

```
packages/
  shared/             # @synthfinder/shared — domain types, interfaces
  mcp-server/         # @synthfinder/mcp-server — MCP server process
  agent/              # Next.js App Router — CLI + web UI
    src/app/          # Next.js pages and API routes
    src/lib/          # Core agent logic
    scripts/          # CLI entry points
evals/                # Eval suites and fixtures
```

Core agent logic lives in `packages/agent/src/lib/` and is framework-agnostic. The CLI and web UI share this logic. See [ADR-005](./adr/005-tech-stack.md) for details.

## Tech Stack

- **TypeScript** (strict mode) with project references
- **Next.js 16** (App Router, Turbopack)
- **Node.js** (latest LTS)
- **Vitest** for testing
- **ESLint + Prettier** for linting and formatting
- **Anthropic SDK** for LLM access

See [ADR-005](./adr/005-tech-stack.md) for rationale.

## Import conventions

TypeScript import extensions vary by package context:

| Location | Local imports | Reason |
|----------|--------------|--------|
| `packages/agent/src/` | No extension — `"./scorer"` | `moduleResolution: bundler` (Next.js) |
| `packages/agent/scripts/` | `.js` extension — `"./scorer.js"` | Node.js ESM requires explicit extensions |
| `packages/mcp-server/src/` | `.js` extension — `"./reverb-client.js"` | Node.js ESM requires explicit extensions |
| Test files (`*.test.ts`) — dynamic `import()` | `.js` extension | Vitest runs under Node.js ESM |

Package imports (`@synthfinder/shared`, `@anthropic-ai/sdk`, etc.) never need extensions.

## ADRs

Architecture Decision Records are in `adr/`. See [README.md](./README.md) for the full index.

## Agent skills

### Issue tracker

Issues are tracked in **Linear** (SynthFinder project, team Rdgallagher) via the
`linear-server` MCP server. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles map to Linear labels of the same name. See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `adr/` at the repo root. See `docs/agents/domain.md`.
