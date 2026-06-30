export type ConditionTier = "mint" | "excellent" | "good" | "fair" | "poor" | "for-parts";

export type DealTier = "strong-bargain" | "fair-deal" | "overpriced";

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  url: string;
  marketplace: string;
  imageUrl?: string;
}

export interface SoldListing extends Listing {
  soldDate: string;
  soldPrice: number;
}

export interface NormalizedListing {
  canonicalModel: string;
  conditionTier: ConditionTier;
  price: number;
  extras: string[];
  redFlags: string[];
  originalListing: Listing;
}

export interface ScoredListing {
  normalizedListing: NormalizedListing;
  dealTier: DealTier;
  reasoning: string;
  comparables: string;
}

export interface WatchlistItem {
  model: string;
  searchQuery?: string;
}

export interface ScanReport {
  watchlistItem: WatchlistItem;
  scoredListings: ScoredListing[];
  scannedAt: string;
}

export interface MarketplaceClient {
  readonly name: string;
  searchListings(query: string): Promise<Listing[]>;
  getSoldListings(query: string, since: Date): Promise<SoldListing[]>;
}

/**
 * Optional domain knowledge to inject into an analysis request. The shape is
 * provider-agnostic; each {@link LLMProvider} decides how — or whether — to
 * apply it.
 */
export interface AnalyzeKnowledge {
  /**
   * Reference to provider-hosted domain knowledge. `AnthropicProvider` treats
   * this as an Anthropic Skill id (`skill_…`) injected via the Skills API;
   * other providers may interpret it differently or ignore it.
   */
  skillId?: string;
}

/**
 * The full input to an analysis: every listing to score, the recent sold comps
 * to calibrate against, and optional domain knowledge. Carrying these together
 * keeps the {@link LLMProvider} seam provider-agnostic.
 */
export interface AnalyzePrompt {
  listings: Listing[];
  soldListings: SoldListing[];
  knowledge?: AnalyzeKnowledge;
}

/**
 * Swappable LLM backend for the analyze task. Implementations own all
 * provider-specific SDKs and types; callers depend only on this interface so
 * the model can be benchmarked or replaced without touching the scan path.
 */
export interface LLMProvider {
  /**
   * Normalize and score every listing in `prompt.listings` against
   * `prompt.soldListings`, returning one {@link ScoredListing} per input
   * listing. `debug`, when supplied, receives provider-internal trace lines.
   */
  analyzeListings(
    prompt: AnalyzePrompt,
    debug?: (msg: string) => void,
  ): Promise<ScoredListing[]>;
}
