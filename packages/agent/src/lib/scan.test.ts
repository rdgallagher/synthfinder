import { describe, it, expect, vi } from "vitest";
import type { Listing, SoldListing, ScoredListing, ScanReport } from "@synthfinder/shared";

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

const fixtureScored: ScoredListing = {
  normalizedListing: {
    canonicalModel: "Roland Juno-106",
    conditionTier: "good",
    price: 120000,
    extras: ["hard case"],
    redFlags: [],
    originalListing: fixtureListing,
  },
  dealTier: "fair-deal",
  reasoning: "Priced near market average for good condition",
  comparables: "1 sold recently at $1,100",
};

describe("scan", () => {
  it("calls onListing for each scored listing", async () => {
    const onListing = vi.fn();
    const { scan } = await import("./scan.js");

    await scan({
      watchlist: [{ model: "Roland Juno-106" }],
      searchListings: vi.fn().mockResolvedValue([fixtureListing]),
      getSoldListings: vi.fn().mockResolvedValue([fixtureSoldListing]),
      analyzeListings: vi.fn().mockResolvedValue([fixtureScored]),
      onListing,
    });

    expect(onListing).toHaveBeenCalledOnce();
    expect(onListing).toHaveBeenCalledWith(fixtureScored);
  });

  it("orchestrates the pipeline: fetch → analyzeListings → report", async () => {
    const mockSearchListings = vi.fn().mockResolvedValue([fixtureListing]);
    const mockGetSoldListings = vi.fn().mockResolvedValue([fixtureSoldListing]);
    const mockAnalyzeListings = vi.fn().mockResolvedValue([fixtureScored]);

    const { scan } = await import("./scan.js");

    const reports: ScanReport[] = await scan({
      watchlist: [{ model: "Roland Juno-106" }],
      searchListings: mockSearchListings,
      getSoldListings: mockGetSoldListings,
      analyzeListings: mockAnalyzeListings,
    });

    expect(mockSearchListings).toHaveBeenCalledWith("Roland Juno-106");
    expect(mockGetSoldListings).toHaveBeenCalledWith("Roland Juno-106", expect.any(Date));
    expect(mockAnalyzeListings).toHaveBeenCalledWith([fixtureListing], [fixtureSoldListing]);

    expect(reports).toHaveLength(1);
    expect(reports[0].watchlistItem.model).toBe("Roland Juno-106");
    expect(reports[0].scoredListings).toEqual([fixtureScored]);
    expect(reports[0].scannedAt).toBeDefined();
  });
});
