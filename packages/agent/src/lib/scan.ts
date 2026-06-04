import type { Listing, SoldListing, ScoredListing, ScanReport, WatchlistItem } from "@synthfinder/shared";

export interface ScanDependencies {
  watchlist: WatchlistItem[];
  searchListings: (query: string) => Promise<Listing[]>;
  getSoldListings: (query: string, since: Date) => Promise<SoldListing[]>;
  analyzeListings: (listings: Listing[], soldListings: SoldListing[]) => Promise<ScoredListing[]>;
  log?: (message: string) => void;
  onListing?: (scored: ScoredListing) => void;
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}

export async function scan(deps: ScanDependencies): Promise<ScanReport[]> {
  const log = deps.log ?? (() => {});
  const reports: ScanReport[] = [];

  log(`Scanning ${deps.watchlist.length} watchlist item(s)`);

  for (const item of deps.watchlist) {
    const query = item.searchQuery ?? item.model;
    const since = new Date();
    since.setDate(since.getDate() - 90);

    log(`${item.model} — fetching listings...`);
    const listings = await deps.searchListings(query);
    const soldListings = await deps.getSoldListings(query, since);
    log(`Found ${listings.length} listings, ${soldListings.length} sold comps (last 90 days)`);

    log(`  Analysing ${listings.length} listings...`);
    const scoredListings = await deps.analyzeListings(listings, soldListings);
    for (const scored of scoredListings) {
      log(`  "${scored.normalizedListing.originalListing.title}" (${formatPrice(scored.normalizedListing.price)}) → ${scored.dealTier}`);
      deps.onListing?.(scored);
    }

    reports.push({
      watchlistItem: item,
      scoredListings,
      scannedAt: new Date().toISOString(),
    });
  }

  const allScored = reports.flatMap((r) => r.scoredListings);
  const strongBargains = allScored.filter((s) => s.dealTier === "strong-bargain").length;
  const fairDeals = allScored.filter((s) => s.dealTier === "fair-deal").length;
  const overpriced = allScored.filter((s) => s.dealTier === "overpriced").length;
  log(`Done — ${strongBargains} strong-bargain, ${fairDeals} fair-deal, ${overpriced} overpriced`);

  return reports;
}
