# Slice 3: Reverb Marketplace Client — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `ReverbMarketplaceClient` so `MARKETPLACE=reverb npm run scan` fetches real listings from Reverb.

**Architecture:** A new `reverb-client.ts` implements the existing `MarketplaceClient` interface and maps Reverb's REST API responses to our shared domain types. It uses an injected `fetch` function so tests run without hitting the network. The server's `getMarketplaceClient` switch gains a `reverb` case.

**Tech Stack:** Node.js built-in `fetch` (no new dependencies), Vitest, TypeScript strict mode.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `evals/fixtures/reverb-responses/search-juno-106.json` | Sample Reverb active-listings API response (used in tests) |
| Create | `evals/fixtures/reverb-responses/sold-juno-106.json` | Sample Reverb sold-listings API response (used in tests) |
| Create | `packages/mcp-server/src/marketplaces/reverb-client.ts` | `ReverbMarketplaceClient` — HTTP calls + mapping to domain types |
| Create | `packages/mcp-server/src/marketplaces/reverb-client.test.ts` | Unit tests using fixture JSON |
| Modify | `packages/mcp-server/src/server.ts` | Add `reverb` case to `getMarketplaceClient` switch |
| Modify | `README.md` | Add `REVERB_API_KEY` to the env vars table |

---

## Task 1: Create Reverb API fixture JSON files

These are the test doubles for Reverb's REST API. We write them first so every later step has concrete data to work with.

**Files:**
- Create: `evals/fixtures/reverb-responses/search-juno-106.json`
- Create: `evals/fixtures/reverb-responses/sold-juno-106.json`

- [ ] **Step 1: Create the active listings fixture**

Create `evals/fixtures/reverb-responses/search-juno-106.json`:

```json
{
  "listings": [
    {
      "id": 1111111,
      "title": "Roland Juno-106 Analog Synth - Excellent Condition",
      "description": "Fully working, all 6 voices good. Recently serviced. Includes power cable.",
      "price": {
        "amount": "1100.00",
        "amount_cents": 110000,
        "currency": "USD"
      },
      "condition": {
        "display_name": "Excellent"
      },
      "_links": {
        "web": { "href": "https://reverb.com/item/1111111" }
      },
      "photos": [
        { "_links": { "full": { "href": "https://images.reverb.com/image/upload/1111111.jpg" } } }
      ],
      "published_at": "2026-03-01T10:00:00Z"
    },
    {
      "id": 2222222,
      "title": "Juno 106 w/ original case - needs chip work",
      "description": "2 of 6 voices cutting out. Includes hard case and manual. Sold as-is.",
      "price": {
        "amount": "550.00",
        "amount_cents": 55000,
        "currency": "USD"
      },
      "condition": {
        "display_name": "Fair"
      },
      "_links": {
        "web": { "href": "https://reverb.com/item/2222222" }
      },
      "photos": [],
      "published_at": "2026-03-10T14:30:00Z"
    }
  ],
  "total": 2,
  "current_page": 1,
  "per_page": 50
}
```

- [ ] **Step 2: Create the sold listings fixture**

Create `evals/fixtures/reverb-responses/sold-juno-106.json`:

```json
{
  "listings": [
    {
      "id": 3333333,
      "title": "Roland Juno-106 Good Condition",
      "description": "All voices working, cosmetic wear.",
      "price": {
        "amount": "1050.00",
        "amount_cents": 105000,
        "currency": "USD"
      },
      "condition": {
        "display_name": "Good"
      },
      "_links": {
        "web": { "href": "https://reverb.com/item/3333333" }
      },
      "photos": [],
      "published_at": "2026-01-15T09:00:00Z"
    },
    {
      "id": 4444444,
      "title": "Roland Juno-106 Mint - Original Box",
      "description": "One owner, pristine.",
      "price": {
        "amount": "1700.00",
        "amount_cents": 170000,
        "currency": "USD"
      },
      "condition": {
        "display_name": "Mint"
      },
      "_links": {
        "web": { "href": "https://reverb.com/item/4444444" }
      },
      "photos": [
        { "_links": { "full": { "href": "https://images.reverb.com/image/upload/4444444.jpg" } } }
      ],
      "published_at": "2025-12-20T16:00:00Z"
    }
  ],
  "total": 2,
  "current_page": 1,
  "per_page": 50
}
```

- [ ] **Step 3: Commit the fixtures**

```bash
git add evals/fixtures/
git commit -m "test: add Reverb API response fixtures for unit tests"
```

---

## Task 2: Implement `ReverbMarketplaceClient`

**Files:**
- Create: `packages/mcp-server/src/marketplaces/reverb-client.ts`
- Create: `packages/mcp-server/src/marketplaces/reverb-client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/mcp-server/src/marketplaces/reverb-client.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MarketplaceClient } from "@synthfinder/shared";
import { ReverbMarketplaceClient } from "./reverb-client.js";

const FIXTURES_DIR = join(process.cwd(), "evals/fixtures/reverb-responses");

function makeResponse(fixture: string): Response {
  const body = readFileSync(join(FIXTURES_DIR, fixture), "utf-8");
  return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("ReverbMarketplaceClient", () => {
  it("implements MarketplaceClient", () => {
    const fetch = vi.fn();
    const client: MarketplaceClient = new ReverbMarketplaceClient("test-key", fetch);
    expect(client.name).toBe("reverb");
  });

  describe("searchListings", () => {
    it("calls the Reverb listings endpoint with the query", async () => {
      const fetch = vi.fn().mockResolvedValue(makeResponse("search-juno-106.json"));
      const client = new ReverbMarketplaceClient("test-key", fetch);

      await client.searchListings("Roland Juno-106");

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("reverb.com");
      expect(url).toContain("Roland+Juno-106");
      expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer test-key");
    });

    it("maps Reverb listings to Listing domain type", async () => {
      const fetch = vi.fn().mockResolvedValue(makeResponse("search-juno-106.json"));
      const client = new ReverbMarketplaceClient("test-key", fetch);

      const listings = await client.searchListings("Roland Juno-106");

      expect(listings).toHaveLength(2);
      const first = listings[0];
      expect(first.id).toBe("1111111");
      expect(first.title).toBe("Roland Juno-106 Analog Synth - Excellent Condition");
      expect(first.price).toBe(110000);
      expect(first.condition).toBe("Excellent");
      expect(first.url).toBe("https://reverb.com/item/1111111");
      expect(first.marketplace).toBe("reverb");
      expect(first.imageUrl).toBe("https://images.reverb.com/image/upload/1111111.jpg");
    });

    it("handles listings with no photos", async () => {
      const fetch = vi.fn().mockResolvedValue(makeResponse("search-juno-106.json"));
      const client = new ReverbMarketplaceClient("test-key", fetch);

      const listings = await client.searchListings("Roland Juno-106");
      const noPhoto = listings.find((l) => l.id === "2222222");

      expect(noPhoto).toBeDefined();
      expect(noPhoto!.imageUrl).toBeUndefined();
    });
  });

  describe("getSoldListings", () => {
    it("calls the Reverb listings endpoint with state=sold", async () => {
      const fetch = vi.fn().mockResolvedValue(makeResponse("sold-juno-106.json"));
      const client = new ReverbMarketplaceClient("test-key", fetch);

      await client.getSoldListings("Roland Juno-106", new Date("2026-01-01"));

      expect(fetch).toHaveBeenCalledOnce();
      const [url] = fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("state=sold");
    });

    it("maps Reverb sold listings to SoldListing domain type", async () => {
      const fetch = vi.fn().mockResolvedValue(makeResponse("sold-juno-106.json"));
      const client = new ReverbMarketplaceClient("test-key", fetch);

      const soldListings = await client.getSoldListings("Roland Juno-106", new Date("2025-01-01"));

      expect(soldListings).toHaveLength(2);
      const first = soldListings[0];
      expect(first.id).toBe("3333333");
      expect(first.soldPrice).toBe(105000);
      expect(first.soldDate).toBe("2026-01-15");
      expect(first.marketplace).toBe("reverb");
    });

    it("filters out sold listings older than the since date", async () => {
      const fetch = vi.fn().mockResolvedValue(makeResponse("sold-juno-106.json"));
      const client = new ReverbMarketplaceClient("test-key", fetch);

      // 2026-02-01 is after both fixture dates (2026-01-15 and 2025-12-20)
      const listings = await client.getSoldListings("Roland Juno-106", new Date("2026-02-01"));

      expect(listings).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A 5 "reverb-client"
```

Expected: FAIL — `Cannot find module './reverb-client.js'`

- [ ] **Step 3: Implement `ReverbMarketplaceClient`**

Create `packages/mcp-server/src/marketplaces/reverb-client.ts`:

```typescript
import type { Listing, SoldListing, MarketplaceClient } from "@synthfinder/shared";

const REVERB_API_BASE = "https://api.reverb.com/api";

interface ReverbPhoto {
  _links: {
    full?: { href: string };
  };
}

interface ReverbListing {
  id: number;
  title: string;
  description: string;
  price: {
    amount: string;
    amount_cents: number;
    currency: string;
  };
  condition: {
    display_name: string;
  };
  _links: {
    web: { href: string };
  };
  photos: ReverbPhoto[];
  published_at: string;
}

interface ReverbSearchResponse {
  listings: ReverbListing[];
  total: number;
  current_page: number;
  per_page: number;
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

function mapListing(raw: ReverbListing): Listing {
  const imageUrl = raw.photos[0]?._links.full?.href;
  return {
    id: String(raw.id),
    title: raw.title,
    description: raw.description,
    price: raw.price.amount_cents,
    condition: raw.condition.display_name,
    url: raw._links.web.href,
    marketplace: "reverb",
    ...(imageUrl ? { imageUrl } : {}),
  };
}

function toIsoDate(isoString: string): string {
  return isoString.slice(0, 10); // "2026-01-15T09:00:00Z" → "2026-01-15"
}

export class ReverbMarketplaceClient implements MarketplaceClient {
  readonly name = "reverb";

  constructor(
    private readonly apiKey: string,
    private readonly fetch: Fetcher = globalThis.fetch,
  ) {}

  async searchListings(query: string): Promise<Listing[]> {
    const url = `${REVERB_API_BASE}/listings?${new URLSearchParams({ query, per_page: "50" })}`;
    const data = await this.get<ReverbSearchResponse>(url);
    return data.listings.map(mapListing);
  }

  async getSoldListings(query: string, since: Date): Promise<SoldListing[]> {
    const url = `${REVERB_API_BASE}/listings?${new URLSearchParams({ query, state: "sold", per_page: "50" })}`;
    const data = await this.get<ReverbSearchResponse>(url);
    return data.listings
      .filter((raw) => new Date(raw.published_at) >= since)
      .map((raw) => ({
        ...mapListing(raw),
        soldPrice: raw.price.amount_cents,
        soldDate: toIsoDate(raw.published_at),
      }));
  }

  private async get<T>(url: string): Promise<T> {
    const response = await this.fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/hal+json; api_version=3.0",
      },
    });
    if (!response.ok) {
      throw new Error(`Reverb API error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A 20 "reverb-client"
```

Expected: all 6 tests in `reverb-client.test.ts` pass.

- [ ] **Step 5: Run full test suite to check no regressions**

```bash
npm test
```

Expected: all 23 existing tests + 6 new = 29 tests, all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-server/src/marketplaces/reverb-client.ts packages/mcp-server/src/marketplaces/reverb-client.test.ts
git commit -m "feat: implement ReverbMarketplaceClient with fetch injection"
```

---

## Task 3: Wire `ReverbMarketplaceClient` into the MCP server

**Files:**
- Modify: `packages/mcp-server/src/server.ts`

- [ ] **Step 1: Add the `reverb` case to `getMarketplaceClient`**

In `packages/mcp-server/src/server.ts`, replace:

```typescript
import { FixtureMarketplaceClient } from "./marketplaces/fixture-client.js";

function getMarketplaceClient(marketplace: string): MarketplaceClient {
  switch (marketplace) {
    case "fixture":
      return new FixtureMarketplaceClient();
    default:
      throw new Error(`Unknown marketplace: ${marketplace}`);
  }
}
```

With:

```typescript
import { FixtureMarketplaceClient } from "./marketplaces/fixture-client.js";
import { ReverbMarketplaceClient } from "./marketplaces/reverb-client.js";

function getMarketplaceClient(marketplace: string): MarketplaceClient {
  switch (marketplace) {
    case "fixture":
      return new FixtureMarketplaceClient();
    case "reverb": {
      const apiKey = process.env.REVERB_API_KEY;
      if (!apiKey) throw new Error("REVERB_API_KEY environment variable is required");
      return new ReverbMarketplaceClient(apiKey);
    }
    default:
      throw new Error(`Unknown marketplace: ${marketplace}`);
  }
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: 29 tests, all pass.

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-server/src/server.ts
git commit -m "feat: wire ReverbMarketplaceClient into MCP server via MARKETPLACE=reverb"
```

---

## Task 4: Document `REVERB_API_KEY` in README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the env var to the table**

In `README.md`, find the env vars table and add a row after `ANTHROPIC_API_KEY`:

```markdown
| `REVERB_API_KEY` | your key | — | Required for `MARKETPLACE=reverb`. Reverb Personal Access Token. |
```

Also update the Quick Start section to include a real-scan example:

```markdown
# Run the scanner against live Reverb data (requires both API keys)
MARKETPLACE=reverb npm run scan
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document REVERB_API_KEY env var"
```

---

## Task 5: Smoke test against the real Reverb API

This is a manual verification step — not part of the automated test suite.

**Prerequisites:** A Reverb Personal Access Token. Generate one at: Settings → Apps → Personal Access Tokens on reverb.com.

- [ ] **Step 1: Set your API key and run the scanner**

```bash
REVERB_API_KEY=<your-token> MARKETPLACE=reverb npm run scan
```

- [ ] **Step 2: Verify the output**

Expected: JSON output with `scoredListings` arrays containing real Juno-106 listings from Reverb. Each listing should have a real URL (e.g. `https://reverb.com/item/...`), real prices, and a `dealTier`.

- [ ] **Step 3: If the mapping is wrong, adjust and re-run**

If the API response shape differs from the fixtures (e.g. different field names, missing `published_at` for sold listings), update:
  - The `ReverbListing` interface in `reverb-client.ts`
  - The `mapListing` / `getSoldListings` logic
  - The fixture JSON files to match the real shape
  - Re-run tests after each change (`npm test`)

Common issues to check:
- `sold` state might need to be `state[]=sold` — if so, change to `new URLSearchParams([["query", query], ["state[]", "sold"], ["per_page", "50"]])`
- Sold date might be a different field (e.g. `updated_at`, `ended_at`) — swap `published_at` references
- `description` might be nested (e.g. `listing.description` vs `listing.description.html`) — strip HTML tags if needed

- [ ] **Step 4: Commit any corrections**

```bash
git add -p
git commit -m "fix: adjust Reverb API mapping based on real API response"
```

---

## Self-Review

**Spec coverage:**
- ✅ `ReverbMarketplaceClient` implements `MarketplaceClient` interface
- ✅ `searchListings` maps to `Listing[]`
- ✅ `getSoldListings` maps to `SoldListing[]` with date filtering
- ✅ `MARKETPLACE=reverb` wires in the new client
- ✅ `REVERB_API_KEY` documented
- ✅ Tests are offline (injected fetch, fixture JSON)
- ✅ Smoke test step for real API verification

**Placeholder scan:** None — all code blocks are complete and runnable.

**Type consistency:** `ReverbListing`, `mapListing`, `ReverbMarketplaceClient` consistent across Tasks 2 and 3. `Listing`/`SoldListing` from `@synthfinder/shared` used correctly throughout.
