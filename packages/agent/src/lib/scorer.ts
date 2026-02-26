import Anthropic from "@anthropic-ai/sdk";
import type {
  NormalizedListing,
  SoldListing,
  ScoredListing,
  DealTier,
} from "@synthfinder/shared";

const anthropic = new Anthropic();

const SCORE_TOOL = {
  name: "score_listing" as const,
  description:
    "Score a synthesizer listing as a deal by comparing to recent sold prices. Always call this tool.",
  input_schema: {
    type: "object" as const,
    properties: {
      deal_tier: {
        type: "string",
        enum: ["strong-bargain", "fair-deal", "overpriced"],
        description: "How good of a deal this listing is",
      },
      reasoning: {
        type: "string",
        description:
          "Human-readable explanation comparing the listing price to recent sold prices, referencing specific numbers",
      },
      comparables: {
        type: "string",
        description: "Summary of the sold listings used for comparison",
      },
    },
    required: ["deal_tier", "reasoning", "comparables"],
  },
};

function stubScore(
  normalized: NormalizedListing,
  soldListings: SoldListing[],
): ScoredListing {
  const avgSoldPrice =
    soldListings.length > 0
      ? soldListings.reduce((sum, s) => sum + s.soldPrice, 0) / soldListings.length
      : normalized.price;

  let dealTier: DealTier;
  if (normalized.price < avgSoldPrice * 0.75) {
    dealTier = "strong-bargain";
  } else if (normalized.price > avgSoldPrice * 1.1) {
    dealTier = "overpriced";
  } else {
    dealTier = "fair-deal";
  }

  return {
    normalizedListing: normalized,
    dealTier,
    reasoning: `Listed at $${(normalized.price / 100).toFixed(0)}. Average sold price: $${(avgSoldPrice / 100).toFixed(0)}.`,
    comparables: `${soldListings.length} sold listings used for comparison.`,
  };
}

interface ScoreToolInput {
  deal_tier: DealTier;
  reasoning: string;
  comparables: string;
}

export async function score(
  normalized: NormalizedListing,
  soldListings: SoldListing[],
): Promise<ScoredListing> {
  if (process.env.LLM_MODE === "stub") {
    return stubScore(normalized, soldListings);
  }

  const soldSummary = soldListings
    .map(
      (s) =>
        `- ${s.title}: sold for $${(s.soldPrice / 100).toFixed(2)} on ${s.soldDate} (${s.condition})`,
    )
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    tools: [SCORE_TOOL],
    tool_choice: { type: "tool", name: "score_listing" },
    messages: [
      {
        role: "user",
        content: `Score this synthesizer listing as a deal.\n\nListing:\n- Model: ${normalized.canonicalModel}\n- Condition: ${normalized.conditionTier}\n- Price: $${(normalized.price / 100).toFixed(2)}\n- Extras: ${normalized.extras.join(", ") || "none"}\n- Red flags: ${normalized.redFlags.join(", ") || "none"}\n\nRecent sold listings for comparison:\n${soldSummary || "No sold data available."}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Scorer: no tool_use block in response");
  }

  const input = toolUse.input as ScoreToolInput;

  return {
    normalizedListing: normalized,
    dealTier: input.deal_tier,
    reasoning: input.reasoning,
    comparables: input.comparables,
  };
}
