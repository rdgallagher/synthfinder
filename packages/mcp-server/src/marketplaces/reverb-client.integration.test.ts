import { describe, it, expect } from "vitest";
import { ReverbMarketplaceClient } from "./reverb-client.js";

const apiKey = process.env.REVERB_API_KEY;

describe.skipIf(!apiKey)("ReverbMarketplaceClient (integration)", () => {
  it("returns full synthesizer listings for a known search term", async () => {
    const client = new ReverbMarketplaceClient(apiKey!);

    const listings = await client.searchListings("Roland Juno-106");

    expect(listings.length).toBeGreaterThan(0);
    for (const listing of listings) {
      expect(listing.id).toBeTruthy();
      expect(listing.title).toBeTruthy();
      expect(listing.price).toBeGreaterThan(0);
      expect(listing.url).toContain("reverb.com");
      expect(listing.marketplace).toBe("reverb");
    }
  }, 15000);
});
