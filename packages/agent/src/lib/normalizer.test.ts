import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Listing, NormalizedListing } from "@synthfinder/shared";

const fixtureListing: Listing = {
  id: "123",
  title: "Roland JUNO 106 great cond w/ case",
  description:
    "All voices working after recent chip replacement. Includes original hard case. No power cable.",
  price: 120000,
  condition: "great condition",
  url: "https://reverb.com/item/123",
  marketplace: "reverb",
};

const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

describe("normalizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LLM_MODE;
  });

  it("returns a stubbed response when LLM_MODE=stub", async () => {
    process.env.LLM_MODE = "stub";

    const { normalize } = await import("./normalizer.js");
    const result: NormalizedListing = await normalize(fixtureListing);

    expect(result.canonicalModel).toBeTruthy();
    expect(result.conditionTier).toBeTruthy();
    expect(result.price).toBe(fixtureListing.price);
    expect(result.originalListing).toBe(fixtureListing);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("throws when the API response contains no tool_use block", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "I cannot help with that." }],
      stop_reason: "end_turn",
    });

    const { normalize } = await import("./normalizer.js");
    await expect(normalize(fixtureListing)).rejects.toThrow(
      "Normalizer: no tool_use block in response",
    );
  });

  it("calls Anthropic API with tool_use when LLM_MODE is not stub", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "tool-1",
          name: "normalize_listing",
          input: {
            canonical_model: "Roland Juno-106",
            condition_tier: "good",
            extras: ["hard case", "recent chip replacement"],
            red_flags: ["no power cable"],
          },
        },
      ],
      stop_reason: "tool_use",
    });

    const { normalize } = await import("./normalizer.js");
    const result = await normalize(fixtureListing);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-haiku-4-5");
    expect(callArgs.tool_choice).toEqual({ type: "tool", name: "normalize_listing" });
    expect(callArgs.tools[0].name).toBe("normalize_listing");

    expect(result.canonicalModel).toBe("Roland Juno-106");
    expect(result.conditionTier).toBe("good");
    expect(result.extras).toContain("hard case");
    expect(result.redFlags).toContain("no power cable");
    expect(result.price).toBe(fixtureListing.price);
    expect(result.originalListing).toBe(fixtureListing);
  });
});
