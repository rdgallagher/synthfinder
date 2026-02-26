import Anthropic from "@anthropic-ai/sdk";
import type { Listing, NormalizedListing, ConditionTier } from "@synthfinder/shared";

const anthropic = new Anthropic();

const NORMALIZE_TOOL = {
  name: "normalize_listing" as const,
  description:
    "Extract structured data from a raw marketplace listing. Always call this tool with the extracted data.",
  input_schema: {
    type: "object" as const,
    properties: {
      canonical_model: {
        type: "string",
        description: "Canonical synth model name, e.g. 'Roland Juno-106'",
      },
      condition_tier: {
        type: "string",
        enum: ["mint", "excellent", "good", "fair", "poor", "for-parts"],
        description: "Condition tier based on listing description",
      },
      extras: {
        type: "array",
        items: { type: "string" },
        description: "Notable extras (case, mods, manuals, etc.)",
      },
      red_flags: {
        type: "array",
        items: { type: "string" },
        description: "Concerns (missing parts, damage, as-is, etc.)",
      },
    },
    required: ["canonical_model", "condition_tier", "extras", "red_flags"],
  },
};

function stubNormalize(listing: Listing): NormalizedListing {
  return {
    canonicalModel: listing.title.replace(/\s+(great|good|fair|mint|excellent).*$/i, "").trim(),
    conditionTier: "good",
    price: listing.price,
    extras: [],
    redFlags: [],
    originalListing: listing,
  };
}

interface NormalizeToolInput {
  canonical_model: string;
  condition_tier: ConditionTier;
  extras: string[];
  red_flags: string[];
}

export async function normalize(listing: Listing): Promise<NormalizedListing> {
  if (process.env.LLM_MODE === "stub") {
    return stubNormalize(listing);
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    tools: [NORMALIZE_TOOL],
    tool_choice: { type: "tool", name: "normalize_listing" },
    messages: [
      {
        role: "user",
        content: `Extract structured data from this marketplace listing:\n\nTitle: ${listing.title}\nDescription: ${listing.description}\nPrice: $${(listing.price / 100).toFixed(2)}\nCondition: ${listing.condition}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Normalizer: no tool_use block in response");
  }

  const input = toolUse.input as NormalizeToolInput;

  return {
    canonicalModel: input.canonical_model,
    conditionTier: input.condition_tier,
    price: listing.price,
    extras: input.extras,
    redFlags: input.red_flags,
    originalListing: listing,
  };
}
