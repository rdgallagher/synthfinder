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
});
