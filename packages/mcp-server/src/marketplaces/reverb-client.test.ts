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
      const headers = init.headers as Record<string, string>;
      expect(url).toContain("reverb.com");
      expect(url).toContain("Roland+Juno-106");
      expect(headers["Authorization"]).toBe("Bearer test-key");
      expect(headers["Accept"]).toBe("application/hal+json");
      expect(headers["Accept-Version"]).toBe("3.0");
    });

    it("filters results to the synthesizers category", async () => {
      const fetch = vi.fn().mockResolvedValue(makeResponse("search-juno-106.json"));
      const client = new ReverbMarketplaceClient("test-key", fetch);

      await client.searchListings("Roland Juno-106");

      const [url] = fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("product_type=keyboards-and-synths");
      expect(url).toContain("category=synths");
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

    it("filters results to the synthesizers category", async () => {
      const fetch = vi.fn().mockResolvedValue(makeResponse("sold-juno-106.json"));
      const client = new ReverbMarketplaceClient("test-key", fetch);

      await client.getSoldListings("Roland Juno-106", new Date("2026-01-01"));

      const [url] = fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("product_type=keyboards-and-synths");
      expect(url).toContain("category=synths");
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

  it("throws on non-ok HTTP response", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }),
    );
    const client = new ReverbMarketplaceClient("bad-key", fetch);

    await expect(client.searchListings("Roland Juno-106")).rejects.toThrow(
      "Reverb API error: 401 Unauthorized",
    );
  });
});
