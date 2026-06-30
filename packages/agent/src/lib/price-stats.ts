import type { SoldListing } from "@synthfinder/shared";

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

  const upper = p75 + 1.5 * iqr;
  const filtered = prices.filter((p) => p <= upper);

  if (filtered.length === 0) {
    return { median, filteredMedian: median, p25, p75, totalCount: n, filteredCount: 0 };
  }

  const fn = filtered.length;
  const filteredMedian =
    fn % 2 === 0
      ? (filtered[fn / 2 - 1] + filtered[fn / 2]) / 2
      : filtered[Math.floor(fn / 2)];

  return { median, filteredMedian, p25, p75, totalCount: n, filteredCount: filtered.length };
}
