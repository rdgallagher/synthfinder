# ADR-002: Marketplace Abstraction

## Status
Accepted

## Context
We're starting with Reverb as our only data source, but we know we'll want to add eBay, Craigslist, and possibly Facebook Marketplace later. Each has different APIs, data formats, and quirks. We need the agent logic to be decoupled from any specific marketplace.

## Decision
Define a `MarketplaceClient` interface that all marketplace integrations must implement:

```typescript
interface MarketplaceClient {
  readonly name: string;
  searchListings(query: string, options?: SearchOptions): Promise<Listing[]>;
  getSoldListings(query: string, since: Date): Promise<SoldListing[]>;
}
```

With shared domain types (`Listing`, `SoldListing`) that represent normalized marketplace data. Each marketplace adapter is responsible for mapping its raw API response into these shared types.

The orchestrator (`scan.ts`) accepts a `MarketplaceClient` — it never imports Reverb directly.

## Consequences
- Adding a new marketplace means implementing one interface, not changing agent logic.
- We can test the agent with a mock/stub marketplace client.
- Some marketplaces (e.g., Craigslist) may not support `getSoldListings` — we'll handle that with optional methods or capability flags when we get there.
- Slight over-engineering for the MVP, but the cost is just one interface definition and it establishes good habits.
