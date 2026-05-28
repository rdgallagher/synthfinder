# SynthFinder Agent

An AI-powered deal scanner for vintage analog synthesizers. Given a watchlist of synth models, it fetches live listings, normalizes and scores each one using Claude Haiku, and outputs a structured deal report as JSON.

**Current state:** CLI scan pipeline complete — live Reverb listings, LLM normalisation and scoring, structured JSON output, file-based logging with optional LLM debug output.

---

## Quick Start

```bash
npm install
cp .env.example .env   # then fill in your API keys

# Run with fixture data — no API keys needed
MARKETPLACE=fixture LLM_MODE=stub npm run scan

# Run against live Reverb data (requires ANTHROPIC_API_KEY + REVERB_API_KEY in .env)
npm run scan

# Show full LLM prompts and responses in the log file
LOG_LEVEL=debug npm run scan
```

### Prerequisites

- Node.js (latest LTS)
- `ANTHROPIC_API_KEY` — required for real LLM calls (normalizer + scorer)
- `REVERB_API_KEY` — required for live Reverb listings; see `.env.example`

---

## Repository Structure

```
packages/
  shared/              # @synthfinder/shared — domain types and interfaces
  mcp-server/          # @synthfinder/mcp-server — marketplace data via MCP
  agent/               # Next.js App Router — CLI entry point and (future) web UI
    scripts/scan.ts    # CLI entry point
    src/lib/           # Core agent logic (framework-agnostic)

evals/
  normalizer/          # Eval cases and runner for the normalizer
  scorer/              # Eval cases and runner for the scorer

adr/                   # Architecture Decision Records
docs/plans/            # Design docs and implementation plans
```

---

## Commands

All commands run from the repo root:

| Command | Description |
|---------|-------------|
| `npm run scan` | Run the deal scanner CLI |
| `npm test` | Run all tests (Vitest) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run type-check` | TypeScript type check (`tsc --build`) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (write) |
| `npm run format:check` | Prettier (check) |
| `npm run dev` | Next.js dev server |
| `npm run eval:normalizer` | Run normalizer evals (requires API key) |
| `npm run eval:scorer` | Run scorer evals (requires API key) |
| `npm run eval` | Run all evals |

---

## Environment Variables

Set these in `.env` (see `.env.example`) — loaded automatically by `npm run scan` and `npm test`.

| Variable | Values | Default | Effect |
|----------|--------|---------|--------|
| `MARKETPLACE` | `reverb`, `fixture` | `reverb` | `reverb` fetches live Reverb listings; `fixture` uses hardcoded Juno-106 data (offline). |
| `LLM_MODE` | `stub` or unset | real LLM | `stub` returns deterministic responses without making API calls. Used in tests. |
| `LOG_LEVEL` | `debug` or unset | silent | `debug` writes LLM prompts and raw responses to the scan log file. |
| `ANTHROPIC_API_KEY` | your key | — | Required for real LLM calls (normalizer, scorer, evals). |
| `REVERB_API_KEY` | your key | — | Required for `MARKETPLACE=reverb`. Reverb Personal Access Token. |

---

## How It Works

### Data Flow

```
Watchlist (hardcoded: Roland Juno-106)
  └─ For each item:
       ├─ MCP tool: search_listings(query)      → Listing[]
       ├─ MCP tool: get_sold_listings(query)     → SoldListing[]
       └─ For each listing:
            ├─ normalize(listing)               → NormalizedListing
            └─ score(normalized, soldListings)  → ScoredListing
  └─ ScanReport[] → stdout as JSON
```

### Two-Process Architecture

The agent spawns the MCP server as a child process and communicates with it over stdio. This keeps marketplace knowledge entirely inside the MCP server — the agent only ever sees domain types (`Listing`, `SoldListing`), never raw marketplace API responses.

```
agent process          MCP server process
──────────────         ──────────────────
SynthfinderMcpClient ←──stdio──→ McpServer
  searchListings()               search_listings tool
  getSoldListings()              get_sold_listings tool
```

### LLM Pipeline

Two Claude Haiku calls per listing, each using forced `tool_use` for structured output:

1. **Normalizer** — `Listing` → `NormalizedListing`
   - Extracts: canonical model name, condition tier, extras (case, mods, etc.), red flags
   - Condition tiers: `mint` | `excellent` | `good` | `fair` | `poor` | `for-parts`

2. **Scorer** — `NormalizedListing` + `SoldListing[]` → `ScoredListing`
   - Compares listing price to recent sold comps
   - Deal tiers: `strong-bargain` | `fair-deal` | `overpriced`
   - Outputs tier, human-readable reasoning, and comparables summary

---

## Key Files

### `packages/shared/src/types.ts`

All domain types. The boundary between the MCP server and the agent — everything flows through these interfaces.

```typescript
Listing          // Raw marketplace listing (id, title, price in cents, condition, url, marketplace)
SoldListing      // Listing + soldDate, soldPrice
NormalizedListing// canonicalModel, conditionTier, price, extras[], redFlags[], originalListing
ScoredListing    // normalizedListing, dealTier, reasoning, comparables
WatchlistItem    // model name + optional searchQuery override
ScanReport       // watchlistItem, scoredListings[], scannedAt (ISO string)
MarketplaceClient// interface: searchListings(), getSoldListings()
```

Prices are stored in **cents** (integers) throughout.

### `packages/mcp-server/src/server.ts`

MCP server factory. Registers three tools:
- `search_listings` — returns `Listing[]` for a query
- `get_sold_listings` — returns `SoldListing[]` since a given date
- `get_supported_marketplaces` — returns available marketplace names

Delegates to a `MarketplaceClient` implementation selected by the `MARKETPLACE` env var.

### `packages/mcp-server/src/marketplaces/reverb-client.ts`

`ReverbMarketplaceClient` — calls the Reverb API v3, filtering by `product_type=keyboards-and-synths&category=synths` to exclude parts and accessories. Results are mapped to domain types with prices in cents.

### `packages/mcp-server/src/marketplaces/fixture-client.ts`

Offline alternative to the Reverb client. Returns hardcoded Juno-106 data — 4 active listings across varied conditions and prices, 3 sold listings for comp data. Used in tests and `MARKETPLACE=fixture` runs.

### `packages/agent/src/lib/scan.ts`

The orchestrator. Takes a `ScanDependencies` object (watchlist + functions for fetching, normalizing, scoring) and wires them into the pipeline. Dependency injection means it's testable without spawning processes or calling LLMs.

### `packages/agent/src/lib/mcp-client.ts`

`SynthfinderMcpClient` — spawns the MCP server as a child process via `npx tsx`, connects via `StdioClientTransport`, and exposes typed `searchListings()` / `getSoldListings()` methods.

### `packages/agent/src/lib/normalizer.ts` and `scorer.ts`

Each exports a single async function (`normalize`, `score`) that calls Claude Haiku with forced `tool_use`. Both accept an optional `debug?` callback — when provided, the LLM prompt is logged before the call and the raw `tool_use` response after. When `LLM_MODE=stub`, returns a deterministic response without making an API call.

### `packages/agent/scripts/scan.ts`

CLI entry point. Wires the MCP client, normalizer, scorer, and logger into `scan()`. Writes a timestamped `.log` file and `.json` report to `output/`. Pass `LOG_LEVEL=debug` to include LLM interaction detail in the log.

### `evals/normalizer/` and `evals/scorer/`

Eval suites for measuring LLM accuracy. Not part of the test suite — run separately with `npm run eval:*`. Require a real `ANTHROPIC_API_KEY`. Each eval has a `cases.json` of hand-labeled Juno-106 examples and an `eval.ts` runner that scores the LLM against them at an 85% pass threshold.

---

## Testing

```bash
npm test          # run all 39 tests
npm test -- --testPathPattern scan.test  # run a specific test file
```

Unit and e2e tests use `LLM_MODE=stub` and `MARKETPLACE=fixture` so they run offline with no API key. The integration test (`reverb-client.integration.test.ts`) hits the real Reverb API and is skipped automatically when `REVERB_API_KEY` is not set.

---

## Architecture Decisions

Significant decisions are recorded in `adr/`:

- [ADR-001](./adr/001-mvp-scope.md) — MVP scope: CLI-based deal scanner
- [ADR-002](./adr/002-marketplace-abstraction.md) — Marketplace abstraction
- [ADR-003](./adr/003-llm-pipeline.md) — Two-stage LLM pipeline (normalizer + scorer)
- [ADR-004](./adr/004-evals-strategy.md) — Evals as first-class citizens
- [ADR-005](./adr/005-tech-stack.md) — Tech stack choices
- [ADR-006](./adr/006-no-database-mvp.md) — No database in MVP
- [ADR-007](./adr/007-deployment-cicd.md) — Deployment and CI/CD
- [ADR-008](./adr/008-mcp-server.md) — MCP server for marketplace data access
- [ADR-009](./adr/009-monorepo-workspaces.md) — Monorepo with npm workspaces

---

## What's Next

- **Web UI:** Next.js interface to browse scan results (the `agent` package skeleton is already in place)
- **Future:** Scheduled scans, alerts, multiple marketplace support
