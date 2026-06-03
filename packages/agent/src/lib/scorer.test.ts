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

describe("computePriceStats", () => {
  it("returns null for an empty list", async () => {
    const { computePriceStats } = await import("./scorer.js");
    expect(computePriceStats([])).toBeNull();
  });

  it("computes median, quartiles, and filtered median for a normal set", async () => {
    const { computePriceStats } = await import("./scorer.js");
    const listings = [100, 110, 120, 130, 140].map((p) => ({
      ...fixtureSoldListings[0],
      soldPrice: p * 100,
    }));

    const stats = computePriceStats(listings)!;

    expect(stats.median).toBe(12000);
    expect(stats.p25).toBe(11000);
    expect(stats.p75).toBe(13000);
    expect(stats.totalCount).toBe(5);
    expect(stats.filteredCount).toBe(5);
    expect(stats.filteredMedian).toBe(12000);
  });

  it("excludes high outliers from the filtered median", async () => {
    const { computePriceStats } = await import("./scorer.js");
    const prices = [100, 110, 120, 130, 500];
    const listings = prices.map((p) => ({
      ...fixtureSoldListings[0],
      soldPrice: p * 100,
    }));

    const stats = computePriceStats(listings)!;

    expect(stats.totalCount).toBe(5);
    expect(stats.filteredCount).toBe(4);
    expect(stats.filteredMedian).toBe(11500);
  });

  it("returns a finite filteredMedian even when all prices are filtered as outliers", async () => {
    // This can't happen with the current upper-only filter, but the guard must hold
    // regardless of future filter changes. We verify the invariant directly.
    const { computePriceStats } = await import("./scorer.js");
    // Two extreme outliers with a tiny IQR force upper very low; if filtered empties out
    // the function must fall back to the unfiltered median rather than return NaN.
    const listings = [100, 100, 100, 1_000_000].map((p) => ({
      ...fixtureSoldListings[0],
      soldPrice: p,
    }));

    const stats = computePriceStats(listings)!;

    expect(Number.isFinite(stats.filteredMedian)).toBe(true);
  });

  it("keeps low outliers — a suspiciously cheap sale is signal, not noise", async () => {
    const { computePriceStats } = await import("./scorer.js");
    const prices = [10, 110, 120, 130, 140]; // 10 is far below the lower IQR bound
    const listings = prices.map((p) => ({
      ...fixtureSoldListings[0],
      soldPrice: p * 100,
    }));

    const stats = computePriceStats(listings)!;

    expect(stats.totalCount).toBe(5);
    expect(stats.filteredCount).toBe(5); // low outlier retained
  });
});

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

  it("stub scores as strong-bargain when listing price is far below average sold", async () => {
    process.env.LLM_MODE = "stub";
    // avg sold = $1,000; listing at $600 = 60% of avg → strong-bargain (< 75%)
    const cheapListing = { ...fixtureNormalized, price: 60000 };
    const soldAt100k = [{ ...fixtureSoldListings[0], soldPrice: 100000 }];

    const { score } = await import("./scorer.js");
    const result = await score(cheapListing, soldAt100k);

    expect(result.dealTier).toBe("strong-bargain");
  });

  it("stub scores as overpriced when listing price is well above average sold", async () => {
    process.env.LLM_MODE = "stub";
    // avg sold = $1,000; listing at $1,200 = 120% of avg → overpriced (> 110%)
    const expensiveListing = { ...fixtureNormalized, price: 120000 };
    const soldAt100k = [{ ...fixtureSoldListings[0], soldPrice: 100000 }];

    const { score } = await import("./scorer.js");
    const result = await score(expensiveListing, soldAt100k);

    expect(result.dealTier).toBe("overpriced");
  });

  it("throws when the API response contains no tool_use block", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "I cannot help with that." }],
      stop_reason: "end_turn",
    });

    const { score } = await import("./scorer.js");
    await expect(score(fixtureNormalized, fixtureSoldListings)).rejects.toThrow(
      "Scorer: no tool_use block in response",
    );
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
            comparables: "2 sold in last 90 days: $1,100 (good), $1,350 (excellent)",
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

  it("includes pre-computed price stats in the prompt", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "tool-1",
          name: "score_listing",
          input: { deal_tier: "fair-deal", reasoning: "ok", comparables: "ok" },
        },
      ],
    });

    const { score } = await import("./scorer.js");
    await score(fixtureNormalized, fixtureSoldListings);

    // fixtureSoldListings soldPrices: [110000, 135000] → filtered median $1,225.00
    const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain("$1,225.00");
  });
});
