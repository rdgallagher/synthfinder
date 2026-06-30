import { describe, it, expect } from "vitest";
import type { Listing, SoldListing } from "@synthfinder/shared";

const cheapListing: Listing = {
  id: "1",
  title: "Roland Juno-106 bargain",
  description: "All voices working.",
  price: 50000,
  condition: "good",
  url: "https://reverb.com/item/1",
  marketplace: "reverb",
};

const pricyListing: Listing = {
  id: "2",
  title: "Roland Juno-106 overpriced",
  description: "Mint.",
  price: 200000,
  condition: "mint",
  url: "https://reverb.com/item/2",
  marketplace: "reverb",
};

const soldListings: SoldListing[] = [
  {
    id: "sold-1",
    title: "Juno 106",
    description: "Good condition",
    price: 100000,
    condition: "good",
    url: "https://reverb.com/item/sold-1",
    marketplace: "reverb",
    soldDate: "2025-12-01",
    soldPrice: 100000,
  },
];

describe("StubProvider", () => {
  it("returns one ScoredListing per input listing without any network call", async () => {
    const { StubProvider } = await import("./stub-provider.js");
    const results = await new StubProvider().analyzeListings({
      listings: [cheapListing, pricyListing],
      soldListings,
    });

    expect(results).toHaveLength(2);
    expect(results[0].normalizedListing.originalListing).toBe(cheapListing);
    expect(results[1].normalizedListing.originalListing).toBe(pricyListing);
  });

  it("scores against the average sold price", async () => {
    const { StubProvider } = await import("./stub-provider.js");
    const results = await new StubProvider().analyzeListings({
      listings: [cheapListing, pricyListing],
      soldListings,
    });

    // 50000 < 100000 * 0.75 → strong-bargain; 200000 > 100000 * 1.1 → overpriced
    expect(results[0].dealTier).toBe("strong-bargain");
    expect(results[1].dealTier).toBe("overpriced");
  });

  it("treats every listing as a strong-bargain when there are no sold comps", async () => {
    const { StubProvider } = await import("./stub-provider.js");
    const results = await new StubProvider().analyzeListings({
      listings: [pricyListing],
      soldListings: [],
    });

    expect(results[0].dealTier).toBe("strong-bargain");
  });
});
