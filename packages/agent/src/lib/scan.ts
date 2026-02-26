import type {
  Listing,
  SoldListing,
  NormalizedListing,
  ScoredListing,
  ScanReport,
  WatchlistItem,
} from "@synthfinder/shared";

export interface ScanDependencies {
  watchlist: WatchlistItem[];
  searchListings: (query: string) => Promise<Listing[]>;
  getSoldListings: (query: string, since: Date) => Promise<SoldListing[]>;
  normalize: (listing: Listing) => Promise<NormalizedListing>;
  score: (normalized: NormalizedListing, soldListings: SoldListing[]) => Promise<ScoredListing>;
}

export async function scan(deps: ScanDependencies): Promise<ScanReport[]> {
  const reports: ScanReport[] = [];

  for (const item of deps.watchlist) {
    const query = item.searchQuery ?? item.model;
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const listings = await deps.searchListings(query);
    const soldListings = await deps.getSoldListings(query, since);

    const scoredListings: ScoredListing[] = [];
    for (const listing of listings) {
      const normalized = await deps.normalize(listing);
      const scored = await deps.score(normalized, soldListings);
      scoredListings.push(scored);
    }

    reports.push({
      watchlistItem: item,
      scoredListings,
      scannedAt: new Date().toISOString(),
    });
  }

  return reports;
}
