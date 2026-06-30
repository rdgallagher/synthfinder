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
  AnalyzePrompt,
  LLMProvider,
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

  it("can construct an AnalyzePrompt with optional knowledge", () => {
    const prompt: AnalyzePrompt = {
      listings: [],
      soldListings: [],
      knowledge: { skillId: "skill_01test" },
    };
    expect(prompt.knowledge?.skillId).toBe("skill_01test");

    const withoutKnowledge: AnalyzePrompt = { listings: [], soldListings: [] };
    expect(withoutKnowledge.knowledge).toBeUndefined();
  });

  it("LLMProvider interface has correct shape", () => {
    const provider: LLMProvider = {
      analyzeListings: async () => [],
    };
    expect(typeof provider.analyzeListings).toBe("function");
  });
});
