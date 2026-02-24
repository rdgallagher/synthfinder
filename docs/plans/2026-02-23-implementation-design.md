# Implementation Design: SynthFinder Agent MVP

## Context

The ADRs (001–008) define the architecture. This design captures the implementation sequencing decisions made during brainstorming.

## Key Decisions

- **Approach:** Outside-in BDD — start from CLI entry point, work inward with stubs, replace with real implementations incrementally
- **Next.js from day one** (updating ADR-005) — the agent package is a Next.js App Router project. Core logic is framework-agnostic in `src/lib/`. CLI scan via `scripts/scan.ts`. Web UI as a fast-follow slice.
- **Monorepo with npm workspaces** (new ADR-009) — agent, MCP server, and shared library are independent packages under `packages/`
- **Fixture-backed marketplace first** — `MarketplaceClient` interface implemented with canned data. Real Reverb swapped in later via the same abstraction.
- **LLM stubs in unit tests, real calls in evals** — fast unit test suite, real LLM validation in eval suites
- **First test synth:** Roland Juno-106

## Codebase Structure

```
project-root/
  package.json              # workspaces: ["packages/*"]
  packages/
    shared/                 # @synthfinder/shared — domain types, interfaces
      src/                  # Types emerge from TDD, not defined up front
      package.json
      tsconfig.json
    mcp-server/             # Standalone process
      src/
        server.ts           # MCP server setup and tool registration
        tools/              # Tool handlers
        marketplaces/       # MarketplaceClient implementations
      package.json
      tsconfig.json
    agent/                  # Next.js App Router project
      src/
        app/                # Next.js pages and API routes
        lib/                # Core agent logic (normalizer, scorer, scan orchestrator)
      scripts/
        scan.ts             # CLI entry point
      package.json
      tsconfig.json
  evals/                    # Eval suites and fixtures
  docs/
  adr/
```

## Implementation Slices

### Slice 1: Project Scaffolding

- Root `package.json` with npm workspaces
- `packages/shared/` — empty TypeScript library
- `packages/mcp-server/` — empty TypeScript project, depends on `@synthfinder/shared`
- `packages/agent/` — Next.js app via `create-next-app`, depends on `@synthfinder/shared`
- `evals/` — empty directory
- ESLint + Prettier at root
- Vitest configured
- Root npm scripts for convenience
- Update ADR-005, add ADR-009

No domain types, no application code. Green builds, passing linter, `npm run dev` shows Next.js default page.

### Slice 2: End-to-End CLI Scan (BDD Outside-In)

Driven by TDD from the outside in:

1. Orchestrator (`scripts/scan.ts`) — reads watchlist (hardcoded Juno-106), calls MCP tools, normalizer → scorer, writes deal report
2. MCP server with fixture-backed `MarketplaceClient` — canned Reverb data for Juno-106
3. Normalizer — real LLM call (Anthropic SDK), prompt + output schema
4. Scorer — same pattern as normalizer
5. First eval cases — hand-labeled Juno-106 cases for each LLM component

Each layer is stubbed first, then implemented, working outside-in.

### Slice 3: Web UI

- Next.js API route — triggers scan, returns JSON
- Next.js page — displays deal report (server component, App Router)
- Same core logic, different entry point

### Slice 4: CI Pipeline

- GitHub Actions — lint, type-check, unit tests across all packages, evals with >=85% threshold
- Added after first behavioral slice so there's something meaningful to gate on
