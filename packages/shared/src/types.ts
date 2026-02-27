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
