import { describe, it, expect, vi } from "vitest";
import type {
  Listing,
  SoldListing,
  NormalizedListing,
  ScoredListing,
  ScanReport,
} from "@synthfinder/shared";

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

    const { scan } = await import("./scan.js");

    const reports: ScanReport[] = await scan({
      watchlist: [{ model: "Roland Juno-106" }],
      searchListings: mockSearchListings,
      getSoldListings: mockGetSoldListings,
      normalize: mockNormalize,
      score: mockScore,
    });

    expect(mockSearchListings).toHaveBeenCalledWith("Roland Juno-106");
    expect(mockGetSoldListings).toHaveBeenCalledWith("Roland Juno-106", expect.any(Date));
    expect(mockNormalize).toHaveBeenCalledWith(fixtureListing);
    expect(mockScore).toHaveBeenCalledWith(fixtureNormalized, [fixtureSoldListing]);

    expect(reports).toHaveLength(1);
    expect(reports[0].watchlistItem.model).toBe("Roland Juno-106");
    expect(reports[0].scoredListings).toEqual([fixtureScored]);
    expect(reports[0].scannedAt).toBeDefined();
  });
});
