import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Listing, SoldListing } from "@synthfinder/shared";

const fixtureListing: Listing = {
  id: "123",
  title: "Roland JUNO 106 great cond w/ case",
  description: "All voices working.",
  price: 80000,
  condition: "Excellent",
  url: "https://reverb.com/item/123",
  marketplace: "reverb",
};

const fixtureListing2: Listing = {
  id: "456",
  title: "Juno 106 needs chip work",
  description: "2 voices cutting out.",
  price: 45000,
  condition: "Fair",
  url: "https://reverb.com/item/456",
  marketplace: "reverb",
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
];

const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

describe("analyzeListings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LLM_MODE;
  });

  it("makes a single API call for all listings", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "tool-1",
          name: "analyze_listings",
          input: {
            results: [
              {
                index: 0,
                canonical_model: "Roland Juno-106",
                condition_tier: "excellent",
                extras: ["hard case"],
                red_flags: [],
                deal_tier: "fair-deal",
                reasoning: "At market",
                comparables: "1 sold at $1,100",
              },
              {
                index: 1,
                canonical_model: "Roland Juno-106",
                condition_tier: "fair",
                extras: [],
                red_flags: ["voices cutting out"],
                deal_tier: "strong-bargain",
                reasoning: "Cheap for parts",
                comparables: "1 sold at $1,100",
              },
            ],
          },
        },
      ],
      stop_reason: "tool_use",
    });

    const { analyzeListings } = await import("./analyzer.js");
    const results = await analyzeListings([fixtureListing, fixtureListing2], fixtureSoldListings);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(2);
  });

  it("includes all listing titles and sold comps in the prompt", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "tool-1",
          name: "analyze_listings",
          input: {
            results: [
              {
                index: 0,
                canonical_model: "Roland Juno-106",
                condition_tier: "excellent",
                extras: [],
                red_flags: [],
                deal_tier: "fair-deal",
                reasoning: "ok",
                comparables: "ok",
              },
            ],
          },
        },
      ],
    });

    const { analyzeListings } = await import("./analyzer.js");
    await analyzeListings([fixtureListing], fixtureSoldListings);

    const callArgs = mockCreate.mock.calls[0][0];
    const allText = (callArgs.messages[0].content as Array<{ text: string }>)
      .map((b) => b.text)
      .join("\n");
    expect(allText).toContain(fixtureListing.title);
    expect(allText).toContain("sold for");
  });

  it("maps results to ScoredListing[] preserving originalListing", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "tool-1",
          name: "analyze_listings",
          input: {
            results: [
              {
                index: 0,
                canonical_model: "Roland Juno-106",
                condition_tier: "excellent",
                extras: ["hard case"],
                red_flags: [],
                deal_tier: "strong-bargain",
                reasoning: "Great deal",
                comparables: "Sold for more",
              },
            ],
          },
        },
      ],
    });

    const { analyzeListings } = await import("./analyzer.js");
    const results = await analyzeListings([fixtureListing], fixtureSoldListings);

    const first = results[0];
    expect(first.dealTier).toBe("strong-bargain");
    expect(first.reasoning).toBe("Great deal");
    expect(first.normalizedListing.canonicalModel).toBe("Roland Juno-106");
    expect(first.normalizedListing.conditionTier).toBe("excellent");
    expect(first.normalizedListing.extras).toEqual(["hard case"]);
    expect(first.normalizedListing.originalListing).toBe(fixtureListing);
    expect(first.normalizedListing.price).toBe(fixtureListing.price);
  });

  it("sorts out-of-order results by index to match input listing order", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "tool-1",
          name: "analyze_listings",
          input: {
            results: [
              {
                index: 1,
                canonical_model: "Roland Juno-106",
                condition_tier: "fair",
                extras: [],
                red_flags: ["voices cutting out"],
                deal_tier: "strong-bargain",
                reasoning: "Cheap",
                comparables: "ok",
              },
              {
                index: 0,
                canonical_model: "Roland Juno-106",
                condition_tier: "excellent",
                extras: [],
                red_flags: [],
                deal_tier: "fair-deal",
                reasoning: "At market",
                comparables: "ok",
              },
            ],
          },
        },
      ],
    });

    const { analyzeListings } = await import("./analyzer.js");
    const results = await analyzeListings([fixtureListing, fixtureListing2], fixtureSoldListings);

    expect(results[0].normalizedListing.originalListing).toBe(fixtureListing);
    expect(results[1].normalizedListing.originalListing).toBe(fixtureListing2);
  });

  it("throws when the API response contains no tool_use block", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "I cannot help with that." }],
      stop_reason: "end_turn",
    });

    const { analyzeListings } = await import("./analyzer.js");
    await expect(analyzeListings([fixtureListing], fixtureSoldListings)).rejects.toThrow(
      "Analyzer: no tool_use block in response",
    );
  });

  it("uses stub mode when LLM_MODE=stub", async () => {
    process.env.LLM_MODE = "stub";

    const { analyzeListings } = await import("./analyzer.js");
    const results = await analyzeListings([fixtureListing, fixtureListing2], fixtureSoldListings);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results.every((r) => ["strong-bargain", "fair-deal", "overpriced"].includes(r.dealTier))).toBe(
      true,
    );
  });
});
