import Anthropic from "@anthropic-ai/sdk";
import type { BetaContentBlockParam, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { Listing, SoldListing, ScoredListing, NormalizedListing, DealTier, ConditionTier } from "@synthfinder/shared";
import { computePriceStats } from "./scorer";

const anthropic = new Anthropic();

const BETAS = ["code-execution-2025-08-25", "skills-2025-10-02"] as const;

const CODE_EXECUTION_TOOL = {
  type: "code_execution_20250825" as const,
  name: "code_execution" as const,
};

const ANALYZE_TOOL = {
  name: "analyze_listings" as const,
  description:
    "Normalize and score all synthesizer listings against recent sold prices. Return a result for every listing in the input.",
  input_schema: {
    type: "object" as const,
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "0-based index matching the input listing position",
            },
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
            deal_tier: {
              type: "string",
              enum: ["strong-bargain", "fair-deal", "overpriced"],
              description: "How good of a deal this listing is compared to the market data",
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
          required: [
            "index",
            "canonical_model",
            "condition_tier",
            "extras",
            "red_flags",
            "deal_tier",
            "reasoning",
            "comparables",
          ],
        },
      },
    },
    required: ["results"],
  },
};

interface AnalyzeResult {
  index: number;
  canonical_model: string;
  condition_tier: ConditionTier;
  extras: string[];
  red_flags: string[];
  deal_tier: DealTier;
  reasoning: string;
  comparables: string;
}

interface AnalyzeToolInput {
  results: AnalyzeResult[];
}

function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function stubAnalyze(listings: Listing[], soldListings: SoldListing[]): ScoredListing[] {
  const avgSoldPrice =
    soldListings.length > 0
      ? soldListings.reduce((sum, s) => sum + s.soldPrice, 0) / soldListings.length
      : 0;

  return listings.map((listing) => {
    let dealTier: DealTier;
    if (avgSoldPrice === 0 || listing.price < avgSoldPrice * 0.75) {
      dealTier = "strong-bargain";
    } else if (listing.price > avgSoldPrice * 1.1) {
      dealTier = "overpriced";
    } else {
      dealTier = "fair-deal";
    }

    const normalized: NormalizedListing = {
      canonicalModel: "Roland Juno-106",
      conditionTier: "good",
      price: listing.price,
      extras: [],
      redFlags: [],
      originalListing: listing,
    };

    return {
      normalizedListing: normalized,
      dealTier,
      reasoning: `Listed at ${formatUSD(listing.price)}. Average sold price: ${formatUSD(avgSoldPrice)}.`,
      comparables: `${soldListings.length} sold listings used for comparison.`,
    };
  });
}

function mapToScoredListings(input: AnalyzeToolInput, listings: Listing[]): ScoredListing[] {
  const sorted = [...input.results].sort((a, b) => a.index - b.index);
  return sorted.map((result) => {
    const listing = listings[result.index];
    const normalized: NormalizedListing = {
      canonicalModel: result.canonical_model,
      conditionTier: result.condition_tier,
      price: listing.price,
      extras: result.extras,
      redFlags: result.red_flags,
      originalListing: listing,
    };
    return {
      normalizedListing: normalized,
      dealTier: result.deal_tier,
      reasoning: result.reasoning,
      comparables: result.comparables,
    };
  });
}

export async function analyzeListings(
  listings: Listing[],
  soldListings: SoldListing[],
  debug?: (msg: string) => void,
): Promise<ScoredListing[]> {
  if (process.env.LLM_MODE === "stub") {
    return stubAnalyze(listings, soldListings);
  }

  const d = debug ?? (() => {});
  const skillId = process.env.ANTHROPIC_SKILL_ID;

  const stats = computePriceStats(soldListings);

  const soldSummary = soldListings
    .map((s) => `- ${s.title}: sold for ${formatUSD(s.soldPrice)} on ${s.soldDate} (${s.condition})`)
    .join("\n");

  const statsSummary = stats
    ? `Market price summary (${stats.filteredCount} of ${stats.totalCount} recent sales, ${stats.totalCount - stats.filteredCount} outliers excluded):\n- Filtered median: ${formatUSD(stats.filteredMedian)}\n- Typical range (p25–p75): ${formatUSD(stats.p25)} – ${formatUSD(stats.p75)}`
    : "No sold data available.";

  const listingsSummary = listings
    .map(
      (listing, i) =>
        `[${i}] Title: ${listing.title}\n    Description: ${listing.description}\n    Price: ${formatUSD(listing.price)}\n    Condition: ${listing.condition}`,
    )
    .join("\n\n");

  const stableBlock = `${statsSummary}\n\nRecent sold listings for reference:\n${soldSummary || "No sold data available."}`;
  const variableBlock = `Analyze these synthesizer listings. For each:\n1. Extract canonical model name, condition tier, extras, and red flags\n2. Score as strong-bargain/fair-deal/overpriced against the market data above\n\nListings to analyze:\n${listingsSummary}`;

  d(`analyzer › input (${listings.length} listings):\n${stableBlock}\n\n${variableBlock}`);

  const userContent: BetaContentBlockParam[] = [
    { type: "text", text: stableBlock },
    { type: "text", text: variableBlock },
  ];

  // Without a skill: single forced tool call via the standard API
  if (!skillId) {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 16384,
      tools: [ANALYZE_TOOL],
      tool_choice: { type: "tool", name: "analyze_listings" },
      messages: [{ role: "user", content: [{ type: "text", text: stableBlock }, { type: "text", text: variableBlock }] }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Analyzer: no tool_use block in response");
    }
    d(`analyzer › output:\n${JSON.stringify(toolUse)}`);
    return mapToScoredListings(toolUse.input as AnalyzeToolInput, listings);
  }

  // With a skill: Phase 1 — let Claude read skill files via code execution
  const container = { skills: [{ type: "custom" as const, skill_id: skillId, version: "latest" }] };
  let messages: BetaMessageParam[] = [{ role: "user", content: userContent }];
  let containerId: string | undefined;

  let response = await anthropic.beta.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 16384,
    betas: [...BETAS],
    container,
    tools: [CODE_EXECUTION_TOOL, ANALYZE_TOOL],
    tool_choice: { type: "auto" },
    messages,
  });

  if (response.container?.id) containerId = response.container.id;

  while (response.stop_reason === "pause_turn") {
    messages = [...messages, { role: "assistant", content: response.content }];
    response = await anthropic.beta.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 16384,
      betas: [...BETAS],
      container: { id: containerId, ...container },
      tools: [CODE_EXECUTION_TOOL, ANALYZE_TOOL],
      tool_choice: { type: "auto" },
      messages,
    });
    if (response.container?.id) containerId = response.container.id;
  }

  // Phase 2: if Claude didn't call analyze_listings yet, force it now
  let toolUse = response.content.find((b) => b.type === "tool_use" && b.name === "analyze_listings");
  if (!toolUse) {
    messages = [...messages, { role: "assistant", content: response.content }];
    response = await anthropic.beta.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 16384,
      betas: [...BETAS],
      container: { id: containerId, ...container },
      tools: [ANALYZE_TOOL],
      tool_choice: { type: "tool", name: "analyze_listings" },
      messages,
    });
    toolUse = response.content.find((b) => b.type === "tool_use");
  }

  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Analyzer: no tool_use block in response");
  }

  d(`analyzer › output:\n${JSON.stringify(toolUse)}`);
  return mapToScoredListings(toolUse.input as AnalyzeToolInput, listings);
}
