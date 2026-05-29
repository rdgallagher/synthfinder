import Anthropic from "@anthropic-ai/sdk";
import type { NormalizedListing, SoldListing, ScoredListing, DealTier } from "@synthfinder/shared";

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

function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}

export interface PriceStats {
  median: number;
  filteredMedian: number;
  p25: number;
  p75: number;
  totalCount: number;
  filteredCount: number;
}

export function computePriceStats(soldListings: SoldListing[]): PriceStats | null {
  if (soldListings.length === 0) return null;

  const prices = [...soldListings.map((s) => s.soldPrice)].sort((a, b) => a - b);
  const n = prices.length;

  const median =
    n % 2 === 0 ? (prices[n / 2 - 1] + prices[n / 2]) / 2 : prices[Math.floor(n / 2)];

  const p25 = prices[Math.floor(n * 0.25)];
  const p75 = prices[Math.floor(n * 0.75)];
  const iqr = p75 - p25;

  const lower = p25 - 1.5 * iqr;
  const upper = p75 + 1.5 * iqr;
  const filtered = prices.filter((p) => p >= lower && p <= upper);

  const fn = filtered.length;
  const filteredMedian =
    fn % 2 === 0
      ? (filtered[fn / 2 - 1] + filtered[fn / 2]) / 2
      : filtered[Math.floor(fn / 2)];

  return { median, filteredMedian, p25, p75, totalCount: n, filteredCount: filtered.length };
}

function stubScore(normalized: NormalizedListing, soldListings: SoldListing[]): ScoredListing {
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
  debug?: (msg: string) => void,
): Promise<ScoredListing> {
  if (process.env.LLM_MODE === "stub") {
    return stubScore(normalized, soldListings);
  }

  const d = debug ?? (() => {});

  const stats = computePriceStats(soldListings);

  const soldSummary = soldListings
    .map((s) => `- ${s.title}: sold for ${formatUSD(s.soldPrice)} on ${s.soldDate} (${s.condition})`)
    .join("\n");

  const statsSummary = stats
    ? `Market price summary (${stats.filteredCount} of ${stats.totalCount} recent sales, ${stats.totalCount - stats.filteredCount} outliers excluded):\n- Filtered median: ${formatUSD(stats.filteredMedian)}\n- Typical range (p25–p75): ${formatUSD(stats.p25)} – ${formatUSD(stats.p75)}`
    : "No sold data available.";

  const prompt = `Score this synthesizer listing as a deal.\n\nListing:\n- Model: ${normalized.canonicalModel}\n- Condition: ${normalized.conditionTier}\n- Price: ${formatUSD(normalized.price)}\n- Extras: ${normalized.extras.join(", ") || "none"}\n- Red flags: ${normalized.redFlags.join(", ") || "none"}\n\n${statsSummary}\n\nRecent sold listings for reference:\n${soldSummary || "No sold data available."}`;

  d(`scorer › input:\n${prompt}`);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    tools: [SCORE_TOOL],
    tool_choice: { type: "tool", name: "score_listing" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Scorer: no tool_use block in response");
  }

  d(`scorer › output:\n${JSON.stringify(toolUse)}`);

  const input = toolUse.input as ScoreToolInput;

  return {
    normalizedListing: normalized,
    dealTier: input.deal_tier,
    reasoning: input.reasoning,
    comparables: input.comparables,
  };
}
