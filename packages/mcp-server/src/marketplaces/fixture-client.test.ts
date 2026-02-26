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

  it("returns varied conditions and prices", async () => {
    const client = new FixtureMarketplaceClient();
    const listings = await client.searchListings("Roland Juno-106");
    const conditions = new Set(listings.map((l) => l.condition));
    expect(conditions.size).toBeGreaterThan(1);
    const prices = listings.map((l) => l.price);
    expect(Math.max(...prices)).toBeGreaterThan(Math.min(...prices));
  });
});
