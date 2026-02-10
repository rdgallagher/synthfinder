# ADR-008: MCP Server for Marketplace Data Access

## Status
Accepted

## Context
The agent needs to fetch active listings and sold-price data from marketplaces. Rather than embedding marketplace API logic directly in the agent, we can expose this data through an MCP (Model Context Protocol) server. This gives the agent a tool-based interface to marketplace data, which is both a natural fit for how LLM agents interact with external systems and a useful learning exercise in MCP server development.

## Decision
Introduce an MCP server that owns all marketplace integration logic and exposes it as tools the agent can call.

**MCP server responsibilities:**
- Implement the `MarketplaceClient` abstraction (from ADR-002) for each marketplace.
- Expose tools such as:
  - `search_listings(query, marketplace?)` — returns active listings matching a query, optionally filtered by marketplace.
  - `get_sold_listings(query, since, marketplace?)` — returns recent sold listings for price context.
  - `get_supported_marketplaces()` — returns which marketplaces are available.
- Normalize raw API responses into the shared `Listing` / `SoldListing` types before returning them to the agent.
- Handle API authentication, rate limiting, and error handling for each marketplace.

**Agent responsibilities (updated):**
- The agent no longer calls marketplace APIs directly.
- It uses MCP tools to request data, then applies the LLM pipeline (normalizer → scorer) to the results.
- The agent's orchestration logic becomes: call MCP tools → normalize → score → write report.

**Project structure update:**
```
src/
  mcp-server/
    server.ts           # MCP server setup and tool registration
    tools/              # Tool handlers (search_listings, get_sold_listings, etc.)
    marketplaces/
      types.ts          # MarketplaceClient interface, Listing, SoldListing
      reverb.ts         # Reverb API implementation
  agent/
    normalizer.ts       # LLM-powered: raw listing → structured data
    scorer.ts           # LLM-powered: listing + price history → deal score
    types.ts            # DealScore, ScoredListing, etc.
  watchlist.ts          # Synth watchlist config
  scan.ts              # Orchestrator: uses MCP tools → normalize → score → report
  index.ts             # CLI entry point
```

## Consequences
- The marketplace data layer is cleanly separated from agent logic, with a well-defined tool interface between them.
- The agent interacts with marketplace data the same way it would in a production agentic system — via tool use — which is a better learning model than direct API calls.
- Adding a new marketplace means adding an implementation inside the MCP server; the agent doesn't change.
- The MCP server can be tested independently of the agent (does it return correct data for a given query?).
- Adds some complexity to the MVP — we need to set up an MCP server and configure the agent to connect to it — but this is valuable learning and the right architecture for an agentic system.
- The MCP server could later be reused by other clients (e.g., a web UI, a different agent) without duplicating marketplace logic.
