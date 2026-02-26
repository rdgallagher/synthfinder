# Slice 2: End-to-End CLI Scan — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI scan that reads a watchlist, fetches listings via MCP tools, normalizes and scores them with an LLM, and outputs a JSON deal report to stdout.

**Architecture:** Stub-heavy top-down BDD. E2e test written first (red), orchestrator wired with stubs, then stubs replaced with real implementations one at a time until e2e goes green. MCP server communicates via stdio transport. LLM calls use Anthropic SDK with tool_use for structured output.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk (MCP server + client), @anthropic-ai/sdk (LLM), Vitest, zod

**Refer to:** `docs/plans/2026-02-25-slice-2-e2e-cli-scan-design.md` for full design context.

---

### Task 1: Install dependencies

**Files:**
- Modify: `packages/mcp-server/package.json`
- Modify: `packages/agent/package.json`
- Modify: `package.json` (root)

**Step 1: Add MCP SDK and zod to mcp-server**

In `packages/mcp-server/package.json`, add to `dependencies`:
```json
"@modelcontextprotocol/sdk": "^1.27.1",
"zod": "^3.24.0"
```

**Step 2: Add Anthropic SDK and MCP SDK to agent**

In `packages/agent/package.json`, add to `dependencies`:
```json
"@anthropic-ai/sdk": "^0.78.0",
"@modelcontextprotocol/sdk": "^1.27.1"
```

**Step 3: Add tsx to root devDependencies**

In root `package.json`, add to `devDependencies`:
```json
"tsx": "^4.0.0"
```

**Step 4: Install**

Run: `npm install`

**Step 5: Commit**

```bash
git add packages/mcp-server/package.json packages/agent/package.json package.json package-lock.json
git commit -m "Add MCP SDK, Anthropic SDK, zod, and tsx dependencies"
```

---

### Task 2: Domain types in @synthfinder/shared

**Files:**
- Create: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/types.test.ts`

**Step 1: Write failing test**

Create `packages/shared/src/types.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import type {
  Listing,
  SoldListing,
  NormalizedListing,
  ScoredListing,
  ScanReport,
  WatchlistItem,
  DealTier,
  ConditionTier,
  MarketplaceClient,
} from "./types.js";

describe("domain types", () => {
  it("can construct a Listing", () => {
    const listing: Listing = {
      id: "123",
      title: "Roland Juno-106",
      description: "Great condition",
      price: 120000,
      condition: "great condition",
      url: "https://reverb.com/item/123",
      marketplace: "reverb",
    };
    expect(listing.id).toBe("123");
    expect(listing.price).toBe(120000);
  });

  it("can construct a SoldListing", () => {
    const sold: SoldListing = {
      id: "456",
      title: "Roland Juno-106",
      description: "Fair condition",
      price: 95000,
      condition: "fair",
      url: "https://reverb.com/item/456",
      marketplace: "reverb",
      soldDate: "2025-12-01",
      soldPrice: 90000,
    };
    expect(sold.soldPrice).toBe(90000);
  });

  it("can construct a NormalizedListing", () => {
    const listing: Listing = {
      id: "123",
      title: "Roland Juno-106",
      description: "Great condition",
      price: 120000,
      condition: "great condition",
      url: "https://reverb.com/item/123",
      marketplace: "reverb",
    };
    const normalized: NormalizedListing = {
      canonicalModel: "Roland Juno-106",
      conditionTier: "good",
      price: 120000,
      extras: ["hard case"],
      redFlags: [],
      originalListing: listing,
    };
    expect(normalized.conditionTier).toBe("good");
  });

  it("can construct a ScoredListing", () => {
    const listing: Listing = {
      id: "123",
      title: "Roland Juno-106",
      description: "Great condition",
      price: 80000,
      condition: "great condition",
      url: "https://reverb.com/item/123",
      marketplace: "reverb",
    };
    const normalized: NormalizedListing = {
      canonicalModel: "Roland Juno-106",
      conditionTier: "good",
      price: 80000,
      extras: [],
      redFlags: [],
      originalListing: listing,
    };
    const scored: ScoredListing = {
      normalizedListing: normalized,
      dealTier: "strong-bargain",
      reasoning: "Listed at $800, similar units sell for $1,100-$1,400",
      comparables: "3 sold in last 90 days: $1,100, $1,250, $1,400",
    };
    expect(scored.dealTier).toBe("strong-bargain");
  });

  it("can construct a ScanReport", () => {
    const report: ScanReport = {
      watchlistItem: { model: "Roland Juno-106" },
      scoredListings: [],
      scannedAt: "2026-02-25T00:00:00Z",
    };
    expect(report.watchlistItem.model).toBe("Roland Juno-106");
  });

  it("MarketplaceClient interface has correct shape", () => {
    const mockClient: MarketplaceClient = {
      name: "fixture",
      searchListings: async () => [],
      getSoldListings: async () => [],
    };
    expect(mockClient.name).toBe("fixture");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./types.js`

**Step 3: Write implementation**

Create `packages/shared/src/types.ts`:
```typescript
export type ConditionTier = "mint" | "excellent" | "good" | "fair" | "poor" | "for-parts";

export type DealTier = "strong-bargain" | "fair-deal" | "overpriced";

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number; // in cents
  condition: string; // raw condition text from marketplace
  url: string;
  marketplace: string;
  imageUrl?: string;
}

export interface SoldListing extends Listing {
  soldDate: string;
  soldPrice: number; // in cents
}

export interface NormalizedListing {
  canonicalModel: string;
  conditionTier: ConditionTier;
  price: number; // in cents
  extras: string[];
  redFlags: string[];
  originalListing: Listing;
}

export interface ScoredListing {
  normalizedListing: NormalizedListing;
  dealTier: DealTier;
  reasoning: string;
  comparables: string;
}

export interface WatchlistItem {
  model: string;
  searchQuery?: string;
}

export interface ScanReport {
  watchlistItem: WatchlistItem;
  scoredListings: ScoredListing[];
  scannedAt: string;
}

export interface MarketplaceClient {
  readonly name: string;
  searchListings(query: string): Promise<Listing[]>;
  getSoldListings(query: string, since: Date): Promise<SoldListing[]>;
}
```

Update `packages/shared/src/index.ts`:
```typescript
export * from "./types.js";
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/types.test.ts packages/shared/src/index.ts
git commit -m "Add domain types to @synthfinder/shared"
```

---

### Task 3: E2e acceptance test (red)

**Files:**
- Create: `packages/agent/src/lib/__tests__/scan.e2e.test.ts`

This test will stay red until the full slice is wired up.

**Step 1: Write the e2e test**

Create `packages/agent/src/lib/__tests__/scan.e2e.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ScanReport } from "@synthfinder/shared";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scanScript = path.resolve(__dirname, "../../../../scripts/scan.ts");

describe("scan e2e", () => {
  it("outputs a JSON deal report for watchlist items", async () => {
    const { stdout } = await execFileAsync("npx", ["tsx", scanScript], {
      env: {
        ...process.env,
        MARKETPLACE: "fixture",
        LLM_MODE: "stub",
      },
      timeout: 30000,
    });

    const reports: ScanReport[] = JSON.parse(stdout);

    expect(Array.isArray(reports)).toBe(true);
    expect(reports.length).toBeGreaterThan(0);

    const report = reports[0];
    expect(report.watchlistItem.model).toBe("Roland Juno-106");
    expect(report.scoredListings.length).toBeGreaterThan(0);
    expect(report.scannedAt).toBeDefined();

    const scored = report.scoredListings[0];
    expect(["strong-bargain", "fair-deal", "overpriced"]).toContain(scored.dealTier);
    expect(scored.reasoning).toBeTruthy();
    expect(scored.normalizedListing.canonicalModel).toBeTruthy();
  }, 30000);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `scan.ts` doesn't exist yet. This is correct — the e2e test stays red until Task 8.

**Step 3: Commit**

```bash
git add packages/agent/src/lib/__tests__/scan.e2e.test.ts
git commit -m "Add e2e acceptance test for scan (red)"
```

---

### Task 4: Scan orchestrator with stubs

**Files:**
- Create: `packages/agent/src/lib/scan.ts`
- Create: `packages/agent/src/lib/scan.test.ts`

**Step 1: Write the failing integration test**

Create `packages/agent/src/lib/scan.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import type {
  Listing,
  SoldListing,
  NormalizedListing,
  ScoredListing,
  ScanReport,
} from "@synthfinder/shared";

// We'll define the scan function's dependencies as interfaces
// so they can be stubbed in tests

const fixtureListing: Listing = {
  id: "123",
  title: "Roland JUNO 106 great cond w/ case",
  description: "All voices working. Includes original hard case.",
  price: 120000,
  condition: "great condition",
  url: "https://reverb.com/item/123",
  marketplace: "reverb",
};

const fixtureSoldListing: SoldListing = {
  id: "456",
  title: "Roland Juno-106 Good Condition",
  description: "Sold listing",
  price: 110000,
  condition: "good",
  url: "https://reverb.com/item/456",
  marketplace: "reverb",
  soldDate: "2025-12-01",
  soldPrice: 110000,
};

const fixtureNormalized: NormalizedListing = {
  canonicalModel: "Roland Juno-106",
  conditionTier: "good",
  price: 120000,
  extras: ["hard case"],
  redFlags: [],
  originalListing: fixtureListing,
};

const fixtureScored: ScoredListing = {
  normalizedListing: fixtureNormalized,
  dealTier: "fair-deal",
  reasoning: "Priced near market average for good condition",
  comparables: "1 sold recently at $1,100",
};

describe("scan", () => {
  it("orchestrates the pipeline: fetch → normalize → score → report", async () => {
    const mockSearchListings = vi.fn().mockResolvedValue([fixtureListing]);
    const mockGetSoldListings = vi.fn().mockResolvedValue([fixtureSoldListing]);
    const mockNormalize = vi.fn().mockResolvedValue(fixtureNormalized);
    const mockScore = vi.fn().mockResolvedValue(fixtureScored);

    // Import scan after defining mocks — scan takes dependencies as params
    const { scan } = await import("./scan.js");

    const reports: ScanReport[] = await scan({
      watchlist: [{ model: "Roland Juno-106" }],
      searchListings: mockSearchListings,
      getSoldListings: mockGetSoldListings,
      normalize: mockNormalize,
      score: mockScore,
    });

    // Verify pipeline wiring
    expect(mockSearchListings).toHaveBeenCalledWith("Roland Juno-106");
    expect(mockGetSoldListings).toHaveBeenCalledWith("Roland Juno-106", expect.any(Date));
    expect(mockNormalize).toHaveBeenCalledWith(fixtureListing);
    expect(mockScore).toHaveBeenCalledWith(fixtureNormalized, [fixtureSoldListing]);

    // Verify report structure
    expect(reports).toHaveLength(1);
    expect(reports[0].watchlistItem.model).toBe("Roland Juno-106");
    expect(reports[0].scoredListings).toEqual([fixtureScored]);
    expect(reports[0].scannedAt).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern scan.test`
Expected: FAIL — `./scan.js` doesn't exist

**Step 3: Write the scan orchestrator**

Create `packages/agent/src/lib/scan.ts`:
```typescript
import type {
  Listing,
  SoldListing,
  NormalizedListing,
  ScoredListing,
  ScanReport,
  WatchlistItem,
} from "@synthfinder/shared";

export interface ScanDependencies {
  watchlist: WatchlistItem[];
  searchListings: (query: string) => Promise<Listing[]>;
  getSoldListings: (query: string, since: Date) => Promise<SoldListing[]>;
  normalize: (listing: Listing) => Promise<NormalizedListing>;
  score: (normalized: NormalizedListing, soldListings: SoldListing[]) => Promise<ScoredListing>;
}

export async function scan(deps: ScanDependencies): Promise<ScanReport[]> {
  const reports: ScanReport[] = [];

  for (const item of deps.watchlist) {
    const query = item.searchQuery ?? item.model;
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const listings = await deps.searchListings(query);
    const soldListings = await deps.getSoldListings(query, since);

    const scoredListings: ScoredListing[] = [];
    for (const listing of listings) {
      const normalized = await deps.normalize(listing);
      const scored = await deps.score(normalized, soldListings);
      scoredListings.push(scored);
    }

    reports.push({
      watchlistItem: item,
      scoredListings,
      scannedAt: new Date().toISOString(),
    });
  }

  return reports;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern scan.test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/agent/src/lib/scan.ts packages/agent/src/lib/scan.test.ts
git commit -m "Add scan orchestrator with dependency injection"
```

---

### Task 5: Fixture marketplace client

**Files:**
- Create: `packages/mcp-server/src/marketplaces/fixture-client.ts`
- Create: `packages/mcp-server/src/marketplaces/fixture-data.ts`
- Create: `packages/mcp-server/src/marketplaces/fixture-client.test.ts`

**Step 1: Write the failing test**

Create `packages/mcp-server/src/marketplaces/fixture-client.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import type { MarketplaceClient } from "@synthfinder/shared";
import { FixtureMarketplaceClient } from "./fixture-client.js";

describe("FixtureMarketplaceClient", () => {
  it("implements MarketplaceClient", () => {
    const client: MarketplaceClient = new FixtureMarketplaceClient();
    expect(client.name).toBe("fixture");
  });

  it("returns listings for Juno-106", async () => {
    const client = new FixtureMarketplaceClient();
    const listings = await client.searchListings("Roland Juno-106");

    expect(listings.length).toBeGreaterThan(0);
    for (const listing of listings) {
      expect(listing.id).toBeTruthy();
      expect(listing.title).toBeTruthy();
      expect(listing.price).toBeGreaterThan(0);
      expect(listing.marketplace).toBe("fixture");
    }
  });

  it("returns sold listings for Juno-106", async () => {
    const client = new FixtureMarketplaceClient();
    const since = new Date("2025-01-01");
    const soldListings = await client.getSoldListings("Roland Juno-106", since);

    expect(soldListings.length).toBeGreaterThan(0);
    for (const sold of soldListings) {
      expect(sold.soldPrice).toBeGreaterThan(0);
      expect(sold.soldDate).toBeTruthy();
    }
  });

  it("returns varied conditions and prices for interesting normalizer input", async () => {
    const client = new FixtureMarketplaceClient();
    const listings = await client.searchListings("Roland Juno-106");

    const conditions = new Set(listings.map((l) => l.condition));
    expect(conditions.size).toBeGreaterThan(1);

    const prices = listings.map((l) => l.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    expect(maxPrice).toBeGreaterThan(minPrice);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern fixture-client`
Expected: FAIL — module not found

**Step 3: Create fixture data**

Create `packages/mcp-server/src/marketplaces/fixture-data.ts`:
```typescript
import type { Listing, SoldListing } from "@synthfinder/shared";

export const JUNO_106_LISTINGS: Listing[] = [
  {
    id: "fix-001",
    title: "Roland JUNO 106 great cond w/ case",
    description:
      "All voices working after recent chip replacement. Includes original hard case. No power cable.",
    price: 120000,
    condition: "great condition",
    url: "https://fixture.test/item/fix-001",
    marketplace: "fixture",
  },
  {
    id: "fix-002",
    title: "Roland Juno-106 - Mint, Original Box",
    description:
      "Pristine condition. All original. Comes with original box and manual. One owner since 1985.",
    price: 185000,
    condition: "mint",
    url: "https://fixture.test/item/fix-002",
    marketplace: "fixture",
  },
  {
    id: "fix-003",
    title: "Juno 106 AS-IS for parts/repair",
    description:
      "Dead voice chips (4 of 6 not working). Cosmetically rough. Selling as-is, no returns. Missing side panel.",
    price: 45000,
    condition: "as-is",
    url: "https://fixture.test/item/fix-003",
    marketplace: "fixture",
  },
  {
    id: "fix-004",
    title: "Roland Juno-106 Analog Synth - Fair Condition",
    description:
      "Works but has sticky keys and some voice chip issues. 2 voices intermittent. Cosmetic wear on panel. Power cable included.",
    price: 75000,
    condition: "fair",
    url: "https://fixture.test/item/fix-004",
    marketplace: "fixture",
  },
];

export const JUNO_106_SOLD_LISTINGS: SoldListing[] = [
  {
    id: "fix-sold-001",
    title: "Roland Juno-106 Good Condition",
    description: "All voices working, some cosmetic wear.",
    price: 110000,
    condition: "good",
    url: "https://fixture.test/item/fix-sold-001",
    marketplace: "fixture",
    soldDate: "2025-12-15",
    soldPrice: 110000,
  },
  {
    id: "fix-sold-002",
    title: "Roland Juno-106 Excellent",
    description: "Recently serviced, all voices perfect.",
    price: 140000,
    condition: "excellent",
    url: "https://fixture.test/item/fix-sold-002",
    marketplace: "fixture",
    soldDate: "2025-11-20",
    soldPrice: 135000,
  },
  {
    id: "fix-sold-003",
    title: "Juno 106 Mint w/ Case",
    description: "Like new. Includes hard case.",
    price: 175000,
    condition: "mint",
    url: "https://fixture.test/item/fix-sold-003",
    marketplace: "fixture",
    soldDate: "2025-10-05",
    soldPrice: 170000,
  },
];
```

**Step 4: Create FixtureMarketplaceClient**

Create `packages/mcp-server/src/marketplaces/fixture-client.ts`:
```typescript
import type { Listing, SoldListing, MarketplaceClient } from "@synthfinder/shared";
import { JUNO_106_LISTINGS, JUNO_106_SOLD_LISTINGS } from "./fixture-data.js";

export class FixtureMarketplaceClient implements MarketplaceClient {
  readonly name = "fixture";

  async searchListings(_query: string): Promise<Listing[]> {
    return JUNO_106_LISTINGS;
  }

  async getSoldListings(_query: string, _since: Date): Promise<SoldListing[]> {
    return JUNO_106_SOLD_LISTINGS;
  }
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- --testPathPattern fixture-client`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/mcp-server/src/marketplaces/
git commit -m "Add FixtureMarketplaceClient with Juno-106 test data"
```

---

### Task 6: MCP server with tools

**Files:**
- Modify: `packages/mcp-server/src/index.ts`
- Create: `packages/mcp-server/src/server.ts`
- Create: `packages/mcp-server/src/server.test.ts`

**Step 1: Write the failing test**

The MCP server test will spin up the server in-process (not via stdio) to test tool handlers directly.

Create `packages/mcp-server/src/server.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import type { Listing, SoldListing } from "@synthfinder/shared";
import { createMcpServer } from "./server.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory";
import { Client } from "@modelcontextprotocol/sdk/client";

describe("MCP server tools", () => {
  async function createTestClient() {
    const server = createMcpServer("fixture");
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({ name: "test-client", version: "0.0.1" });
    await client.connect(clientTransport);

    return { client, server };
  }

  it("lists available tools", async () => {
    const { client } = await createTestClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    expect(names).toContain("search_listings");
    expect(names).toContain("get_sold_listings");
    expect(names).toContain("get_supported_marketplaces");

    await client.close();
  });

  it("search_listings returns Listing[]", async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({
      name: "search_listings",
      arguments: { query: "Roland Juno-106" },
    });

    expect(result.isError).toBeFalsy();
    const textBlock = result.content.find(
      (c): c is { type: "text"; text: string } => c.type === "text",
    );
    expect(textBlock).toBeDefined();

    const listings: Listing[] = JSON.parse(textBlock!.text);
    expect(listings.length).toBeGreaterThan(0);
    expect(listings[0].id).toBeTruthy();
    expect(listings[0].marketplace).toBe("fixture");

    await client.close();
  });

  it("get_sold_listings returns SoldListing[]", async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({
      name: "get_sold_listings",
      arguments: { query: "Roland Juno-106", since: "2025-01-01" },
    });

    expect(result.isError).toBeFalsy();
    const textBlock = result.content.find(
      (c): c is { type: "text"; text: string } => c.type === "text",
    );
    const soldListings: SoldListing[] = JSON.parse(textBlock!.text);
    expect(soldListings.length).toBeGreaterThan(0);
    expect(soldListings[0].soldPrice).toBeGreaterThan(0);

    await client.close();
  });

  it("get_supported_marketplaces returns marketplace names", async () => {
    const { client } = await createTestClient();
    const result = await client.callTool({
      name: "get_supported_marketplaces",
      arguments: {},
    });

    const textBlock = result.content.find(
      (c): c is { type: "text"; text: string } => c.type === "text",
    );
    const marketplaces: string[] = JSON.parse(textBlock!.text);
    expect(marketplaces).toContain("fixture");

    await client.close();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern server.test`
Expected: FAIL — `./server.js` doesn't exist

**Step 3: Write the MCP server**

Create `packages/mcp-server/src/server.ts`:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server";
import { z } from "zod";
import type { MarketplaceClient } from "@synthfinder/shared";
import { FixtureMarketplaceClient } from "./marketplaces/fixture-client.js";

function getMarketplaceClient(marketplace: string): MarketplaceClient {
  switch (marketplace) {
    case "fixture":
      return new FixtureMarketplaceClient();
    default:
      throw new Error(`Unknown marketplace: ${marketplace}`);
  }
}

export function createMcpServer(defaultMarketplace: string = "fixture"): McpServer {
  const server = new McpServer({
    name: "synthfinder-mcp-server",
    version: "0.0.1",
  });

  server.registerTool(
    "search_listings",
    {
      description: "Search active listings across marketplaces",
      inputSchema: z.object({
        query: z.string().describe("Search query, e.g. 'Roland Juno-106'"),
        marketplace: z.string().optional().describe("Marketplace to search (default: all)"),
      }),
    },
    async (args) => {
      const client = getMarketplaceClient(args.marketplace ?? defaultMarketplace);
      const listings = await client.searchListings(args.query);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(listings) }],
      };
    },
  );

  server.registerTool(
    "get_sold_listings",
    {
      description: "Get recently sold listings for price comparison",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
        since: z.string().describe("ISO date string for how far back to look"),
        marketplace: z.string().optional().describe("Marketplace to search (default: all)"),
      }),
    },
    async (args) => {
      const client = getMarketplaceClient(args.marketplace ?? defaultMarketplace);
      const soldListings = await client.getSoldListings(args.query, new Date(args.since));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(soldListings) }],
      };
    },
  );

  server.registerTool(
    "get_supported_marketplaces",
    {
      description: "List available marketplaces",
      inputSchema: z.object({}),
    },
    async () => {
      return {
        content: [{ type: "text" as const, text: JSON.stringify([defaultMarketplace]) }],
      };
    },
  );

  return server;
}
```

Update `packages/mcp-server/src/index.ts` to be the stdio entry point:
```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server";
import { createMcpServer } from "./server.js";

const marketplace = process.env.MARKETPLACE ?? "fixture";
const server = createMcpServer(marketplace);
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern server.test`
Expected: PASS

Note: If `InMemoryTransport` is not available at `@modelcontextprotocol/sdk/inMemory`, check the SDK exports. It may be at `@modelcontextprotocol/sdk/server` or another path. Adapt the import accordingly.

**Step 5: Commit**

```bash
git add packages/mcp-server/src/server.ts packages/mcp-server/src/server.test.ts packages/mcp-server/src/index.ts
git commit -m "Add MCP server with search_listings, get_sold_listings, get_supported_marketplaces"
```

---

### Task 7: MCP client (agent side)

**Files:**
- Create: `packages/agent/src/lib/mcp-client.ts`
- Create: `packages/agent/src/lib/mcp-client.test.ts`

**Step 1: Write the failing test**

Create `packages/agent/src/lib/mcp-client.test.ts`:
```typescript
import { describe, it, expect, afterEach } from "vitest";
import type { Listing, SoldListing } from "@synthfinder/shared";
import { SynthfinderMcpClient } from "./mcp-client.js";

describe("SynthfinderMcpClient", () => {
  let mcpClient: SynthfinderMcpClient;

  afterEach(async () => {
    if (mcpClient) {
      await mcpClient.close();
    }
  });

  it("connects to MCP server and searches listings", async () => {
    mcpClient = new SynthfinderMcpClient();
    await mcpClient.connect();

    const listings: Listing[] = await mcpClient.searchListings("Roland Juno-106");

    expect(listings.length).toBeGreaterThan(0);
    expect(listings[0].id).toBeTruthy();
    expect(listings[0].marketplace).toBe("fixture");
  });

  it("gets sold listings", async () => {
    mcpClient = new SynthfinderMcpClient();
    await mcpClient.connect();

    const since = new Date("2025-01-01");
    const soldListings: SoldListing[] = await mcpClient.getSoldListings("Roland Juno-106", since);

    expect(soldListings.length).toBeGreaterThan(0);
    expect(soldListings[0].soldPrice).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern mcp-client`
Expected: FAIL — module not found

**Step 3: Write the MCP client wrapper**

Create `packages/agent/src/lib/mcp-client.ts`:
```typescript
import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client";
import type { Listing, SoldListing } from "@synthfinder/shared";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class SynthfinderMcpClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;

  constructor() {
    this.client = new Client({
      name: "synthfinder-agent",
      version: "0.0.1",
    });
  }

  async connect(): Promise<void> {
    const serverScript = path.resolve(__dirname, "../../../mcp-server/src/index.ts");

    this.transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", serverScript],
      env: {
        ...process.env,
        MARKETPLACE: process.env.MARKETPLACE ?? "fixture",
      },
    });

    await this.client.connect(this.transport);
  }

  async searchListings(query: string): Promise<Listing[]> {
    const result = await this.client.callTool({
      name: "search_listings",
      arguments: { query },
    });

    const textBlock = result.content.find(
      (c): c is { type: "text"; text: string } => c.type === "text",
    );
    if (!textBlock) throw new Error("No text content in search_listings response");

    return JSON.parse(textBlock.text) as Listing[];
  }

  async getSoldListings(query: string, since: Date): Promise<SoldListing[]> {
    const result = await this.client.callTool({
      name: "get_sold_listings",
      arguments: { query, since: since.toISOString() },
    });

    const textBlock = result.content.find(
      (c): c is { type: "text"; text: string } => c.type === "text",
    );
    if (!textBlock) throw new Error("No text content in get_sold_listings response");

    return JSON.parse(textBlock.text) as SoldListing[];
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern mcp-client`
Expected: PASS — spawns real MCP server process with fixture data

**Step 5: Commit**

```bash
git add packages/agent/src/lib/mcp-client.ts packages/agent/src/lib/mcp-client.test.ts
git commit -m "Add typed MCP client wrapper with stdio transport"
```

---

### Task 8: Normalizer

**Files:**
- Create: `packages/agent/src/lib/normalizer.ts`
- Create: `packages/agent/src/lib/normalizer.test.ts`

**Step 1: Write the failing test**

Create `packages/agent/src/lib/normalizer.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Listing, NormalizedListing } from "@synthfinder/shared";

const fixtureListing: Listing = {
  id: "123",
  title: "Roland JUNO 106 great cond w/ case",
  description:
    "All voices working after recent chip replacement. Includes original hard case. No power cable.",
  price: 120000,
  condition: "great condition",
  url: "https://reverb.com/item/123",
  marketplace: "reverb",
};

// Mock the Anthropic SDK
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

describe("normalizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LLM_MODE;
  });

  it("returns a stubbed response when LLM_MODE=stub", async () => {
    process.env.LLM_MODE = "stub";

    const { normalize } = await import("./normalizer.js");
    const result: NormalizedListing = await normalize(fixtureListing);

    expect(result.canonicalModel).toBeTruthy();
    expect(result.conditionTier).toBeTruthy();
    expect(result.price).toBe(fixtureListing.price);
    expect(result.originalListing).toBe(fixtureListing);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("calls Anthropic API with tool_use when LLM_MODE is not stub", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "tool-1",
          name: "normalize_listing",
          input: {
            canonical_model: "Roland Juno-106",
            condition_tier: "good",
            extras: ["hard case", "recent chip replacement"],
            red_flags: ["no power cable"],
          },
        },
      ],
      stop_reason: "tool_use",
    });

    const { normalize } = await import("./normalizer.js");
    const result = await normalize(fixtureListing);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-haiku-4-5");
    expect(callArgs.tool_choice).toEqual({ type: "tool", name: "normalize_listing" });
    expect(callArgs.tools[0].name).toBe("normalize_listing");

    expect(result.canonicalModel).toBe("Roland Juno-106");
    expect(result.conditionTier).toBe("good");
    expect(result.extras).toContain("hard case");
    expect(result.redFlags).toContain("no power cable");
    expect(result.price).toBe(fixtureListing.price);
    expect(result.originalListing).toBe(fixtureListing);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern normalizer`
Expected: FAIL — module not found

**Step 3: Write the normalizer**

Create `packages/agent/src/lib/normalizer.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { Listing, NormalizedListing, ConditionTier } from "@synthfinder/shared";

const anthropic = new Anthropic();

const NORMALIZE_TOOL = {
  name: "normalize_listing" as const,
  description:
    "Extract structured data from a raw marketplace listing. Always call this tool with the extracted data.",
  input_schema: {
    type: "object" as const,
    properties: {
      canonical_model: {
        type: "string",
        description: "Canonical synth model name, e.g. 'Roland Juno-106'",
      },
      condition_tier: {
        type: "string",
        enum: ["mint", "excellent", "good", "fair", "poor", "for-parts"],
        description: "Condition tier based on listing description",
      },
      extras: {
        type: "array",
        items: { type: "string" },
        description: "Notable extras (case, mods, manuals, etc.)",
      },
      red_flags: {
        type: "array",
        items: { type: "string" },
        description: "Concerns (missing parts, damage, as-is, etc.)",
      },
    },
    required: ["canonical_model", "condition_tier", "extras", "red_flags"],
  },
};

function stubNormalize(listing: Listing): NormalizedListing {
  return {
    canonicalModel: listing.title.replace(/\s+(great|good|fair|mint|excellent).*$/i, "").trim(),
    conditionTier: "good",
    price: listing.price,
    extras: [],
    redFlags: [],
    originalListing: listing,
  };
}

interface NormalizeToolInput {
  canonical_model: string;
  condition_tier: ConditionTier;
  extras: string[];
  red_flags: string[];
}

export async function normalize(listing: Listing): Promise<NormalizedListing> {
  if (process.env.LLM_MODE === "stub") {
    return stubNormalize(listing);
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    tools: [NORMALIZE_TOOL],
    tool_choice: { type: "tool", name: "normalize_listing" },
    messages: [
      {
        role: "user",
        content: `Extract structured data from this marketplace listing:\n\nTitle: ${listing.title}\nDescription: ${listing.description}\nPrice: $${(listing.price / 100).toFixed(2)}\nCondition: ${listing.condition}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Normalizer: no tool_use block in response");
  }

  const input = toolUse.input as NormalizeToolInput;

  return {
    canonicalModel: input.canonical_model,
    conditionTier: input.condition_tier,
    price: listing.price,
    extras: input.extras,
    redFlags: input.red_flags,
    originalListing: listing,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern normalizer`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/agent/src/lib/normalizer.ts packages/agent/src/lib/normalizer.test.ts
git commit -m "Add normalizer with Anthropic tool_use and stub mode"
```

---

### Task 9: Scorer

**Files:**
- Create: `packages/agent/src/lib/scorer.ts`
- Create: `packages/agent/src/lib/scorer.test.ts`

**Step 1: Write the failing test**

Create `packages/agent/src/lib/scorer.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Listing, NormalizedListing, SoldListing, ScoredListing } from "@synthfinder/shared";

const fixtureListing: Listing = {
  id: "123",
  title: "Roland JUNO 106 great cond w/ case",
  description: "All voices working.",
  price: 80000,
  condition: "great",
  url: "https://reverb.com/item/123",
  marketplace: "reverb",
};

const fixtureNormalized: NormalizedListing = {
  canonicalModel: "Roland Juno-106",
  conditionTier: "good",
  price: 80000,
  extras: ["hard case"],
  redFlags: [],
  originalListing: fixtureListing,
};

const fixtureSoldListings: SoldListing[] = [
  {
    id: "sold-1",
    title: "Juno 106",
    description: "Good condition",
    price: 110000,
    condition: "good",
    url: "https://reverb.com/item/sold-1",
    marketplace: "reverb",
    soldDate: "2025-12-01",
    soldPrice: 110000,
  },
  {
    id: "sold-2",
    title: "Juno 106",
    description: "Excellent condition",
    price: 140000,
    condition: "excellent",
    url: "https://reverb.com/item/sold-2",
    marketplace: "reverb",
    soldDate: "2025-11-15",
    soldPrice: 135000,
  },
];

const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

describe("scorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LLM_MODE;
  });

  it("returns a stubbed response when LLM_MODE=stub", async () => {
    process.env.LLM_MODE = "stub";

    const { score } = await import("./scorer.js");
    const result: ScoredListing = await score(fixtureNormalized, fixtureSoldListings);

    expect(["strong-bargain", "fair-deal", "overpriced"]).toContain(result.dealTier);
    expect(result.reasoning).toBeTruthy();
    expect(result.normalizedListing).toBe(fixtureNormalized);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("calls Anthropic API with tool_use when LLM_MODE is not stub", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "tool-1",
          name: "score_listing",
          input: {
            deal_tier: "strong-bargain",
            reasoning:
              "Listed at $800. Similar units in good condition sold for $1,100-$1,350. This is well below market.",
            comparables:
              "2 sold in last 90 days: $1,100 (good), $1,350 (excellent)",
          },
        },
      ],
      stop_reason: "tool_use",
    });

    const { score } = await import("./scorer.js");
    const result = await score(fixtureNormalized, fixtureSoldListings);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-haiku-4-5");
    expect(callArgs.tool_choice).toEqual({ type: "tool", name: "score_listing" });

    expect(result.dealTier).toBe("strong-bargain");
    expect(result.reasoning).toContain("$800");
    expect(result.comparables).toBeTruthy();
    expect(result.normalizedListing).toBe(fixtureNormalized);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern scorer`
Expected: FAIL — module not found

**Step 3: Write the scorer**

Create `packages/agent/src/lib/scorer.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import type {
  NormalizedListing,
  SoldListing,
  ScoredListing,
  DealTier,
} from "@synthfinder/shared";

const anthropic = new Anthropic();

const SCORE_TOOL = {
  name: "score_listing" as const,
  description:
    "Score a synthesizer listing as a deal by comparing to recent sold prices. Always call this tool.",
  input_schema: {
    type: "object" as const,
    properties: {
      deal_tier: {
        type: "string",
        enum: ["strong-bargain", "fair-deal", "overpriced"],
        description: "How good of a deal this listing is",
      },
      reasoning: {
        type: "string",
        description:
          "Human-readable explanation comparing the listing price to recent sold prices, referencing specific numbers",
      },
      comparables: {
        type: "string",
        description: "Summary of the sold listings used for comparison",
      },
    },
    required: ["deal_tier", "reasoning", "comparables"],
  },
};

function stubScore(
  normalized: NormalizedListing,
  soldListings: SoldListing[],
): ScoredListing {
  const avgSoldPrice =
    soldListings.length > 0
      ? soldListings.reduce((sum, s) => sum + s.soldPrice, 0) / soldListings.length
      : normalized.price;

  let dealTier: DealTier;
  if (normalized.price < avgSoldPrice * 0.75) {
    dealTier = "strong-bargain";
  } else if (normalized.price > avgSoldPrice * 1.1) {
    dealTier = "overpriced";
  } else {
    dealTier = "fair-deal";
  }

  return {
    normalizedListing: normalized,
    dealTier,
    reasoning: `Listed at $${(normalized.price / 100).toFixed(0)}. Average sold price: $${(avgSoldPrice / 100).toFixed(0)}.`,
    comparables: `${soldListings.length} sold listings used for comparison.`,
  };
}

interface ScoreToolInput {
  deal_tier: DealTier;
  reasoning: string;
  comparables: string;
}

export async function score(
  normalized: NormalizedListing,
  soldListings: SoldListing[],
): Promise<ScoredListing> {
  if (process.env.LLM_MODE === "stub") {
    return stubScore(normalized, soldListings);
  }

  const soldSummary = soldListings
    .map(
      (s) =>
        `- ${s.title}: sold for $${(s.soldPrice / 100).toFixed(2)} on ${s.soldDate} (${s.condition})`,
    )
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    tools: [SCORE_TOOL],
    tool_choice: { type: "tool", name: "score_listing" },
    messages: [
      {
        role: "user",
        content: `Score this synthesizer listing as a deal.\n\nListing:\n- Model: ${normalized.canonicalModel}\n- Condition: ${normalized.conditionTier}\n- Price: $${(normalized.price / 100).toFixed(2)}\n- Extras: ${normalized.extras.join(", ") || "none"}\n- Red flags: ${normalized.redFlags.join(", ") || "none"}\n\nRecent sold listings for comparison:\n${soldSummary || "No sold data available."}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Scorer: no tool_use block in response");
  }

  const input = toolUse.input as ScoreToolInput;

  return {
    normalizedListing: normalized,
    dealTier: input.deal_tier,
    reasoning: input.reasoning,
    comparables: input.comparables,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern scorer`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/agent/src/lib/scorer.ts packages/agent/src/lib/scorer.test.ts
git commit -m "Add scorer with Anthropic tool_use and stub mode"
```

---

### Task 10: CLI entry point and e2e green

**Files:**
- Create: `packages/agent/scripts/scan.ts`
- Remove: `packages/agent/scripts/.gitkeep`

**Step 1: Write the CLI entry point**

Create `packages/agent/scripts/scan.ts`:
```typescript
import type { WatchlistItem } from "@synthfinder/shared";
import { scan } from "../src/lib/scan.js";
import { SynthfinderMcpClient } from "../src/lib/mcp-client.js";
import { normalize } from "../src/lib/normalizer.js";
import { score } from "../src/lib/scorer.js";

const watchlist: WatchlistItem[] = [{ model: "Roland Juno-106" }];

const mcpClient = new SynthfinderMcpClient();
await mcpClient.connect();

try {
  const reports = await scan({
    watchlist,
    searchListings: (query) => mcpClient.searchListings(query),
    getSoldListings: (query, since) => mcpClient.getSoldListings(query, since),
    normalize,
    score,
  });

  console.log(JSON.stringify(reports, null, 2));
} finally {
  await mcpClient.close();
}
```

**Step 2: Delete the placeholder**

```bash
rm packages/agent/scripts/.gitkeep
```

**Step 3: Run the e2e test**

Run: `npm test -- --testPathPattern e2e`
Expected: PASS — the full pipeline is now wired up with fixture marketplace and stub LLM.

If the e2e test fails, debug the wiring. Common issues:
- Path resolution for the MCP server script (check the `__dirname` resolution in `mcp-client.ts`)
- Environment variables not propagating to child process
- Timeout — increase if the MCP server takes time to start

**Step 4: Run the scan manually to see output**

Run: `MARKETPLACE=fixture LLM_MODE=stub npx tsx packages/agent/scripts/scan.ts`
Expected: JSON output with ScanReport[] for Juno-106

**Step 5: Commit**

```bash
git rm packages/agent/scripts/.gitkeep
git add packages/agent/scripts/scan.ts
git commit -m "Add CLI scan entry point — e2e test green"
```

---

### Task 11: Normalizer evals

**Files:**
- Create: `evals/normalizer/cases.json`
- Create: `evals/normalizer/eval.ts`
- Modify: `package.json` (add eval scripts)

**Step 1: Create eval cases**

Create `evals/normalizer/cases.json`:
```json
[
  {
    "input": {
      "id": "eval-n-001",
      "title": "Roland JUNO 106 great cond w/ case",
      "description": "All voices working after recent chip replacement. Includes original hard case. No power cable.",
      "price": 120000,
      "condition": "great condition",
      "url": "https://reverb.com/item/001",
      "marketplace": "reverb"
    },
    "expected": {
      "canonicalModel": "Roland Juno-106",
      "conditionTier": "good",
      "extras": ["hard case", "voice chip replacement"],
      "redFlags": ["no power cable"]
    }
  },
  {
    "input": {
      "id": "eval-n-002",
      "title": "Roland Juno-106 - Mint, Original Box",
      "description": "Pristine condition. All original. Comes with original box and manual. One owner since 1985.",
      "price": 185000,
      "condition": "mint",
      "url": "https://reverb.com/item/002",
      "marketplace": "reverb"
    },
    "expected": {
      "canonicalModel": "Roland Juno-106",
      "conditionTier": "mint",
      "extras": ["original box", "manual"],
      "redFlags": []
    }
  },
  {
    "input": {
      "id": "eval-n-003",
      "title": "Juno 106 AS-IS for parts/repair",
      "description": "Dead voice chips (4 of 6 not working). Cosmetically rough. Selling as-is, no returns. Missing side panel.",
      "price": 45000,
      "condition": "as-is",
      "url": "https://reverb.com/item/003",
      "marketplace": "reverb"
    },
    "expected": {
      "canonicalModel": "Roland Juno-106",
      "conditionTier": "for-parts",
      "extras": [],
      "redFlags": ["dead voice chips", "as-is", "missing side panel"]
    }
  },
  {
    "input": {
      "id": "eval-n-004",
      "title": "Roland Juno-106 Analog Synth - Fair Condition",
      "description": "Works but has sticky keys and some voice chip issues. 2 voices intermittent. Cosmetic wear on panel. Power cable included.",
      "price": 75000,
      "condition": "fair",
      "url": "https://reverb.com/item/004",
      "marketplace": "reverb"
    },
    "expected": {
      "canonicalModel": "Roland Juno-106",
      "conditionTier": "fair",
      "extras": ["power cable"],
      "redFlags": ["sticky keys", "voice chip issues"]
    }
  },
  {
    "input": {
      "id": "eval-n-005",
      "title": "Juno-106 Excellent - Serviced 2024",
      "description": "Fully serviced in 2024. All new voice chips installed. New battery. Sounds incredible. Includes sustain pedal.",
      "price": 155000,
      "condition": "excellent",
      "url": "https://reverb.com/item/005",
      "marketplace": "reverb"
    },
    "expected": {
      "canonicalModel": "Roland Juno-106",
      "conditionTier": "excellent",
      "extras": ["new voice chips", "new battery", "sustain pedal", "serviced 2024"],
      "redFlags": []
    }
  }
]
```

**Step 2: Create eval runner**

Create `evals/normalizer/eval.ts`:
```typescript
import { normalize } from "../../packages/agent/src/lib/normalizer.js";
import type { Listing, ConditionTier } from "@synthfinder/shared";

interface EvalCase {
  input: Listing;
  expected: {
    canonicalModel: string;
    conditionTier: ConditionTier;
    extras: string[];
    redFlags: string[];
  };
}

// Fuzzy match: check if expected items are present in actual (case-insensitive, substring)
function fuzzyArrayMatch(actual: string[], expected: string[]): number {
  if (expected.length === 0) return actual.length === 0 ? 1 : 0.5;
  let matches = 0;
  for (const exp of expected) {
    const found = actual.some(
      (a) =>
        a.toLowerCase().includes(exp.toLowerCase()) ||
        exp.toLowerCase().includes(a.toLowerCase()),
    );
    if (found) matches++;
  }
  return matches / expected.length;
}

async function main() {
  // Ensure we're using real LLM, not stubs
  delete process.env.LLM_MODE;

  const casesFile = new URL("./cases.json", import.meta.url);
  const cases: EvalCase[] = JSON.parse(
    await import("node:fs/promises").then((fs) => fs.readFile(casesFile, "utf-8")),
  );

  let totalFields = 0;
  let correctFields = 0;
  const results: Array<{ id: string; pass: boolean; details: string[] }> = [];

  for (const evalCase of cases) {
    const details: string[] = [];
    let caseCorrect = 0;
    let caseTotal = 0;

    try {
      const result = await normalize(evalCase.input);

      // Check canonical model
      caseTotal++;
      if (result.canonicalModel.toLowerCase() === evalCase.expected.canonicalModel.toLowerCase()) {
        caseCorrect++;
      } else {
        details.push(
          `canonicalModel: expected "${evalCase.expected.canonicalModel}", got "${result.canonicalModel}"`,
        );
      }

      // Check condition tier
      caseTotal++;
      if (result.conditionTier === evalCase.expected.conditionTier) {
        caseCorrect++;
      } else {
        details.push(
          `conditionTier: expected "${evalCase.expected.conditionTier}", got "${result.conditionTier}"`,
        );
      }

      // Check extras (fuzzy)
      caseTotal++;
      const extrasScore = fuzzyArrayMatch(result.extras, evalCase.expected.extras);
      if (extrasScore >= 0.5) {
        caseCorrect++;
      } else {
        details.push(
          `extras: expected ${JSON.stringify(evalCase.expected.extras)}, got ${JSON.stringify(result.extras)}`,
        );
      }

      // Check red flags (fuzzy)
      caseTotal++;
      const flagsScore = fuzzyArrayMatch(result.redFlags, evalCase.expected.redFlags);
      if (flagsScore >= 0.5) {
        caseCorrect++;
      } else {
        details.push(
          `redFlags: expected ${JSON.stringify(evalCase.expected.redFlags)}, got ${JSON.stringify(result.redFlags)}`,
        );
      }
    } catch (error) {
      details.push(`ERROR: ${error}`);
      caseTotal = 4;
    }

    totalFields += caseTotal;
    correctFields += caseCorrect;
    results.push({
      id: evalCase.input.id,
      pass: caseCorrect === caseTotal,
      details,
    });
  }

  // Report
  console.log("\n=== Normalizer Eval Results ===\n");
  for (const r of results) {
    console.log(`${r.pass ? "✅" : "❌"} ${r.id}`);
    for (const d of r.details) {
      console.log(`   ${d}`);
    }
  }

  const accuracy = ((correctFields / totalFields) * 100).toFixed(1);
  console.log(`\nField accuracy: ${correctFields}/${totalFields} (${accuracy}%)`);
  console.log(`Threshold: 85%`);

  if (correctFields / totalFields < 0.85) {
    console.log("FAIL: Below threshold");
    process.exit(1);
  } else {
    console.log("PASS");
  }
}

main();
```

**Step 3: Add eval scripts to root package.json**

Add to root `package.json` scripts:
```json
"eval:normalizer": "tsx evals/normalizer/eval.ts",
"eval:scorer": "tsx evals/scorer/eval.ts",
"eval": "npm run eval:normalizer && npm run eval:scorer"
```

**Step 4: Commit**

Do NOT run the eval yet (it requires a real API key). Just commit the structure.

```bash
git add evals/normalizer/ package.json
git commit -m "Add normalizer eval suite with 5 Juno-106 cases"
```

---

### Task 12: Scorer evals

**Files:**
- Create: `evals/scorer/cases.json`
- Create: `evals/scorer/eval.ts`

**Step 1: Create eval cases**

Create `evals/scorer/cases.json`:
```json
[
  {
    "input": {
      "normalized": {
        "canonicalModel": "Roland Juno-106",
        "conditionTier": "good",
        "price": 80000,
        "extras": ["hard case"],
        "redFlags": [],
        "originalListing": {
          "id": "eval-s-001",
          "title": "Roland Juno-106",
          "description": "Good condition with case",
          "price": 80000,
          "condition": "good",
          "url": "https://reverb.com/item/001",
          "marketplace": "reverb"
        }
      },
      "soldListings": [
        { "id": "s1", "title": "Juno-106", "description": "Good", "price": 110000, "condition": "good", "url": "https://reverb.com/s1", "marketplace": "reverb", "soldDate": "2025-12-01", "soldPrice": 110000 },
        { "id": "s2", "title": "Juno-106", "description": "Good", "price": 125000, "condition": "good", "url": "https://reverb.com/s2", "marketplace": "reverb", "soldDate": "2025-11-15", "soldPrice": 120000 }
      ]
    },
    "expected": {
      "dealTier": "strong-bargain",
      "reasoning_must_mention": ["$800", "$1,100"]
    }
  },
  {
    "input": {
      "normalized": {
        "canonicalModel": "Roland Juno-106",
        "conditionTier": "mint",
        "price": 185000,
        "extras": ["original box", "manual"],
        "redFlags": [],
        "originalListing": {
          "id": "eval-s-002",
          "title": "Juno-106 Mint",
          "description": "Pristine",
          "price": 185000,
          "condition": "mint",
          "url": "https://reverb.com/item/002",
          "marketplace": "reverb"
        }
      },
      "soldListings": [
        { "id": "s3", "title": "Juno-106 Mint", "description": "Mint", "price": 175000, "condition": "mint", "url": "https://reverb.com/s3", "marketplace": "reverb", "soldDate": "2025-10-05", "soldPrice": 170000 }
      ]
    },
    "expected": {
      "dealTier": "overpriced",
      "reasoning_must_mention": ["$1,850", "$1,700"]
    }
  },
  {
    "input": {
      "normalized": {
        "canonicalModel": "Roland Juno-106",
        "conditionTier": "good",
        "price": 115000,
        "extras": [],
        "redFlags": [],
        "originalListing": {
          "id": "eval-s-003",
          "title": "Juno-106",
          "description": "Good condition",
          "price": 115000,
          "condition": "good",
          "url": "https://reverb.com/item/003",
          "marketplace": "reverb"
        }
      },
      "soldListings": [
        { "id": "s1", "title": "Juno-106", "description": "Good", "price": 110000, "condition": "good", "url": "https://reverb.com/s1", "marketplace": "reverb", "soldDate": "2025-12-01", "soldPrice": 110000 },
        { "id": "s2", "title": "Juno-106", "description": "Good", "price": 125000, "condition": "good", "url": "https://reverb.com/s2", "marketplace": "reverb", "soldDate": "2025-11-15", "soldPrice": 120000 }
      ]
    },
    "expected": {
      "dealTier": "fair-deal",
      "reasoning_must_mention": ["$1,150"]
    }
  }
]
```

**Step 2: Create eval runner**

Create `evals/scorer/eval.ts`:
```typescript
import { score } from "../../packages/agent/src/lib/scorer.js";
import type { NormalizedListing, SoldListing, DealTier } from "@synthfinder/shared";

interface EvalCase {
  input: {
    normalized: NormalizedListing;
    soldListings: SoldListing[];
  };
  expected: {
    dealTier: DealTier;
    reasoning_must_mention: string[];
  };
}

async function main() {
  delete process.env.LLM_MODE;

  const casesFile = new URL("./cases.json", import.meta.url);
  const cases: EvalCase[] = JSON.parse(
    await import("node:fs/promises").then((fs) => fs.readFile(casesFile, "utf-8")),
  );

  let passed = 0;
  const results: Array<{ id: string; pass: boolean; details: string[] }> = [];

  for (const evalCase of cases) {
    const details: string[] = [];
    let casePassed = true;

    try {
      const result = await score(evalCase.input.normalized, evalCase.input.soldListings);

      // Check deal tier
      if (result.dealTier !== evalCase.expected.dealTier) {
        casePassed = false;
        details.push(
          `dealTier: expected "${evalCase.expected.dealTier}", got "${result.dealTier}"`,
        );
      }

      // Check reasoning mentions required terms
      for (const term of evalCase.expected.reasoning_must_mention) {
        if (!result.reasoning.includes(term)) {
          casePassed = false;
          details.push(`reasoning missing: "${term}" not found in "${result.reasoning}"`);
        }
      }

      // Check reasoning is substantial (not just a few words)
      if (result.reasoning.length < 20) {
        casePassed = false;
        details.push(`reasoning too short: ${result.reasoning.length} chars`);
      }
    } catch (error) {
      casePassed = false;
      details.push(`ERROR: ${error}`);
    }

    if (casePassed) passed++;
    results.push({
      id: evalCase.input.normalized.originalListing.id,
      pass: casePassed,
      details,
    });
  }

  // Report
  console.log("\n=== Scorer Eval Results ===\n");
  for (const r of results) {
    console.log(`${r.pass ? "✅" : "❌"} ${r.id}`);
    for (const d of r.details) {
      console.log(`   ${d}`);
    }
  }

  const passRate = ((passed / cases.length) * 100).toFixed(1);
  console.log(`\nPass rate: ${passed}/${cases.length} (${passRate}%)`);
  console.log(`Threshold: 85%`);

  if (passed / cases.length < 0.85) {
    console.log("FAIL: Below threshold");
    process.exit(1);
  } else {
    console.log("PASS");
  }
}

main();
```

**Step 3: Commit**

```bash
git add evals/scorer/
git commit -m "Add scorer eval suite with 3 Juno-106 cases"
```

---

### Task 13: Final verification and cleanup

**Step 1: Run all unit/integration tests**

Run: `npm test`
Expected: All tests pass (domain types, scan orchestrator, fixture client, MCP server, MCP client, normalizer, scorer, e2e)

**Step 2: Run lint and format**

Run: `npm run lint && npm run format:check`
Expected: Clean

**Step 3: Run type-check**

Run: `npm run type-check`
Expected: Clean

**Step 4: Manual smoke test**

Run: `MARKETPLACE=fixture LLM_MODE=stub npx tsx packages/agent/scripts/scan.ts`
Expected: JSON output with scored Juno-106 listings

**Step 5: Run evals (optional — requires ANTHROPIC_API_KEY)**

Run: `npm run eval:normalizer` and `npm run eval:scorer`
Expected: Both pass ≥85% threshold

No commit — this is just verification.
