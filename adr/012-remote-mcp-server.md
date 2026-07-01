# ADR-012: Deploy the MCP Server as a Standalone Remote Service

## Status
Proposed

## Context

[ADR-008](./008-mcp-server.md) introduced the MCP server as the single boundary for
marketplace data access. In the current implementation the agent process **spawns
that server as a stdio child process** — `packages/agent/src/lib/mcp-client.ts` uses
`StdioClientTransport` with `command: "npx"`.

Spawning a long-lived child process requires a **persistent server runtime**, which
is why the app was originally deployed to Fly.io. That coupling is now a problem:

- The Fly trial has lapsed, so production is down.
- We want to deploy on **Vercel** (already wired to the repo), but Vercel's
  serverless functions cannot host a persistent stdio child process. The scan path
  therefore cannot run on Vercel as-is.

There are two ways to unblock Vercel:

- **(a) Inline** the `MarketplaceClient` into the request path, dropping MCP from the
  deployed app (MCP would survive only for local/CLI use). Simplest, but the
  deployed app and the CLI would then use **different data-access paths**.
- **(b) Promote** the MCP server to a **standalone networked service** the web app
  calls over HTTP. Keeps one uniform MCP path everywhere.

Vercel now supports hosting MCP servers directly (the `mcp-handler` package exposes
an MCP server as a route over **Streamable HTTP**, running on **Fluid compute** —
which suits the idle/burst pattern, so no separate always-on host is needed). It
also provides `withMcpAuth` for authorization. This makes option (b) only marginally
more work than (a), while preserving the architecture and matching the direction of
travel for MCP (remote servers over Streamable HTTP).

## Decision

The MCP server becomes a **standalone remote service** exposing its tools over
**authenticated Streamable HTTP**, deployed independently of the web app.

- The web app is a **pure MCP client**: `StdioClientTransport` is replaced with a
  Streamable HTTP client transport pointing at the service URL, carrying a bearer
  token. No child process on the request path → the app runs on Vercel serverless.
- **Auth** is a shared **bearer token** (an env var on both sides), verified
  server-side. Full OAuth per the MCP spec is available but out of scope for now.
- The client selects transport by environment: **stdio for local dev / CLI**,
  **Streamable HTTP in deployed environments** — so local ergonomics are unchanged.
- **Fly is retired.**

The logical boundary — a remote MCP service over authenticated Streamable HTTP, with
the web app as a pure client — is what this ADR commits to. The **leading
implementation** is to host the service as its own Vercel project using
`mcp-handler` (`createMcpHandler` + `withMcpAuth`) on Fluid compute, so both the web
app and the MCP service run on Vercel. The service could instead run on any host
(Render/Railway/etc.) without changing the boundary.

## Consequences

- **Vercel-deployable end to end**, and Fly is removed. Resolves the deployment
  blocker in issue #5.
- **Uniform data access**: CLI and web both speak MCP; the deployed path no longer
  diverges from local.
- **New surface**: a network hop plus an authenticated public endpoint. The MCP
  service now holds the Reverb API key (instead of the web app), gated by a bearer
  token that must be provisioned on both sides and rotated via env.
- **Two deployments to coordinate** (web app + MCP service) and a shared secret to
  manage — the explicit cost of choosing uniformity over inlining.
- The MCP server is refactored from a low-level stdio server into an `mcp-handler`
  route. **Tool logic (the Reverb client) is unchanged** — only the transport and
  tool registration move.
- Giving up the simplicity of a single deployment is deliberate: judged worthwhile
  for a showcase project because it keeps the MCP abstraction honest and demonstrates
  a remote-MCP deployment. If the refactor proves disproportionate, option (a)
  (inline) remains a fallback that this ADR would supersede.
