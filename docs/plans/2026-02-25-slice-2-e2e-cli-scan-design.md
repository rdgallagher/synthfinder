# Slice 2: End-to-End CLI Scan — Design

## Context

Slice 1 scaffolded the monorepo. Slice 2 implements the first behavioral slice: a CLI scan that takes a watchlist, fetches listings via MCP tools, normalizes and scores them with an LLM, and outputs a deal report as JSON to stdout.

## Key Decisions

- **Approach:** Stub-heavy top-down. Full orchestrator with stubs first, then replace stubs with real implementations one at a time. E2e test written first (red), goes green last.
- **MCP transport:** Stdio (agent spawns MCP server as child process via `@modelcontextprotocol/sdk`). Production-correct pattern from day one.
- **Fixture data:** Reverb-shaped fixtures inside MCP server only. Agent sees domain types only — no Reverb knowledge leaks through.
- **LLM output:** Structured output via `tool_use` with JSON schema. Type-safe from LLM through to report.
- **Deal scoring:** Tiers (strong-bargain / fair-deal / overpriced). Simpler to eval, more human-meaningful.
- **Environment-driven config:** `MARKETPLACE=fixture` for fixture data, `LLM_MODE=stub` for canned LLM responses. Default is real calls.
- **Model:** Claude Haiku for normalizer and scorer (fast, cheap, sufficient for extraction).
- **First test synth:** Roland Juno-106.

## Domain Types

In `@synthfinder/shared` (added incrementally as tests drive them):

- `Listing` — id, title, description, price, condition (raw string), url, marketplace, imageUrl
- `SoldListing` — extends Listing with soldDate, soldPrice
- `NormalizedListing` — canonicalModel, conditionTier (mint/excellent/good/fair/poor/for-parts), price, extras, redFlags, originalListing
- `DealTier` — "strong-bargain" | "fair-deal" | "overpriced"
- `ScoredListing` — normalizedListing, dealTier, reasoning, comparables summary
- `ScanReport` — watchlistItem, scoredListings[], scannedAt
- `WatchlistItem` — model name, optional search query override
- `MarketplaceClient` interface — searchListings(), getSoldListings()

## Data Flow

```
Read watchlist (hardcoded Juno-106)
  → For each watchlist item:
      → MCP tool: search_listings(query)         → Listing[]
      → MCP tool: get_sold_listings(query)        → SoldListing[]
      → For each listing:
          → Normalizer(listing)                   → NormalizedListing
          → Scorer(normalizedListing, soldListings) → ScoredListing
      → Collect into ScanReport
  → Output ScanReport[] as JSON to stdout
```

## MCP Server

Exposes three tools via `StdioServerTransport`:

- `search_listings` — `{ query, marketplace? }` → `Listing[]`
- `get_sold_listings` — `{ query, since, marketplace? }` → `SoldListing[]`
- `get_supported_marketplaces` — → `string[]`

Each tool delegates to a `MarketplaceClient`. Slice 2 implements `FixtureMarketplaceClient` only (canned Juno-106 data). `ReverbMarketplaceClient` deferred.

Agent-side MCP client (`packages/agent/src/lib/mcp-client.ts`) uses `StdioClientTransport`, spawns the MCP server as a child process, and exposes typed helper functions.

## LLM Components

**Normalizer** — `Listing` → `NormalizedListing`. Anthropic SDK, `tool_use` schema. Extracts canonical model, condition tier, price, extras, red flags.

**Scorer** — `NormalizedListing` + `SoldListing[]` → `ScoredListing`. Anthropic SDK, `tool_use` schema. Compares price to sold comps, outputs deal tier + reasoning.

Both use `LLM_MODE=stub` for deterministic test responses.

## Testing Strategy

**E2e test** (written first, green last):
- Spawns `scripts/scan.ts` with `MARKETPLACE=fixture` and `LLM_MODE=stub`
- Asserts stdout is valid `ScanReport[]` JSON with scored Juno-106 listings

**Unit/integration tests** (green incrementally):
- Orchestrator: stubs MCP client, normalizer, scorer — asserts pipeline wiring
- MCP server tools: `FixtureMarketplaceClient` — asserts domain types
- MCP client: typed helpers parse tool responses correctly
- Normalizer: stubs Anthropic SDK — asserts prompt construction and response parsing
- Scorer: same pattern

**Evals** (real LLM, separate from test suite):
- Normalizer: field-level accuracy on 10-15 hand-labeled Juno-106 cases (≥85%)
- Scorer: deal tier in acceptable range + reasoning quality check
- Run via `npm run eval:normalizer` / `npm run eval:scorer`

## Implementation Order (Outside-In)

1. E2e test (red)
2. Domain types driven out by orchestrator test
3. Orchestrator with all stubs — integration test green
4. MCP server with fixture marketplace — MCP server tests green
5. MCP client with StdioClientTransport — replace MCP stub in orchestrator
6. Normalizer — real Anthropic SDK, stubbed in unit tests — replace normalizer stub
7. Scorer — same pattern — replace scorer stub
8. E2e goes green
9. Evals — hand-labeled cases for normalizer and scorer
10. CLI entry point — `scripts/scan.ts` wires orchestrator, prints to stdout
