# ADR-009: Monorepo with npm Workspaces

## Status
Accepted

## Context
The agent and MCP server are independently runnable/deployable units that need to share domain types and interfaces. We need a codebase structure that supports this without duplicating shared code.

## Decision
Use an npm workspaces monorepo with three packages:

- **`@synthfinder/shared`** — Domain types and interfaces shared across packages.
- **`@synthfinder/mcp-server`** — MCP server for marketplace data access, runs as an independent process.
- **Agent (root Next.js app)** — Next.js App Router project with CLI entry point and web UI.

Shared types are exported as raw TypeScript source (no build step) and consumed via workspace dependencies. The agent imports shared types using Next.js `transpilePackages`. The MCP server imports shared types using TypeScript project references.

## Consequences
- Clean dependency boundaries between packages.
- Shared types without duplication across agent and MCP server.
- Independent test suites per package.
- Independent deployability — the MCP server and agent can be deployed separately.
- Slightly more config overhead than a single project (workspace config, project references).
- The agent depends on shared (via `transpilePackages`), the MCP server depends on shared (via TypeScript project references), but agent and MCP server never depend on each other.
