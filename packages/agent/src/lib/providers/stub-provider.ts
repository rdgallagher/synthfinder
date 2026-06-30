import type {
  AnalyzePrompt,
  DealTier,
  LLMProvider,
  NormalizedListing,
  ScoredListing,
} from "@synthfinder/shared";

function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/**
 * In-memory {@link LLMProvider} that scores listings with a cheap heuristic and
 * makes no network call. Used when `LLM_MODE=stub` so tests and the fixture
 * scan path run without an API key — the in-memory adapter at the
 * `ScanDependencies.analyzeListings` seam anticipated by ADR-011.
 */
export class StubProvider implements LLMProvider {
  async analyzeListings(prompt: AnalyzePrompt): Promise<ScoredListing[]> {
    const { listings, soldListings } = prompt;
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
}
