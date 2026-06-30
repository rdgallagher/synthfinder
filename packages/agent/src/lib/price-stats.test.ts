import { describe, it, expect } from "vitest";
import type { SoldListing } from "@synthfinder/shared";
import { computePriceStats } from "./price-stats.js";

const baseSold: SoldListing = {
  id: "sold-1",
  title: "Juno 106",
  description: "Good condition",
  price: 110000,
  condition: "good",
  url: "https://reverb.com/item/sold-1",
  marketplace: "reverb",
  soldDate: "2025-12-01",
  soldPrice: 110000,
};

describe("computePriceStats", () => {
  it("returns null for an empty list", () => {
    expect(computePriceStats([])).toBeNull();
  });

  it("computes median, quartiles, and filtered median for a normal set", () => {
    const listings = [100, 110, 120, 130, 140].map((p) => ({
      ...baseSold,
      soldPrice: p * 100,
    }));

    const stats = computePriceStats(listings)!;

    expect(stats.median).toBe(12000);
    expect(stats.p25).toBe(11000);
    expect(stats.p75).toBe(13000);
    expect(stats.totalCount).toBe(5);
    expect(stats.filteredCount).toBe(5);
    expect(stats.filteredMedian).toBe(12000);
  });

  it("excludes high outliers from the filtered median", () => {
    const prices = [100, 110, 120, 130, 500];
    const listings = prices.map((p) => ({
      ...baseSold,
      soldPrice: p * 100,
    }));

    const stats = computePriceStats(listings)!;

    expect(stats.totalCount).toBe(5);
    expect(stats.filteredCount).toBe(4);
    expect(stats.filteredMedian).toBe(11500);
  });

  it("returns a finite filteredMedian even when all prices are filtered as outliers", () => {
    // This can't happen with the current upper-only filter, but the guard must hold
    // regardless of future filter changes. We verify the invariant directly.
    // Two extreme outliers with a tiny IQR force upper very low; if filtered empties out
    // the function must fall back to the unfiltered median rather than return NaN.
    const listings = [100, 100, 100, 1_000_000].map((p) => ({
      ...baseSold,
      soldPrice: p,
    }));

    const stats = computePriceStats(listings)!;

    expect(Number.isFinite(stats.filteredMedian)).toBe(true);
  });

  it("keeps low outliers — a suspiciously cheap sale is signal, not noise", () => {
    const prices = [10, 110, 120, 130, 140]; // 10 is far below the lower IQR bound
    const listings = prices.map((p) => ({
      ...baseSold,
      soldPrice: p * 100,
    }));

    const stats = computePriceStats(listings)!;

    expect(stats.totalCount).toBe(5);
    expect(stats.filteredCount).toBe(5); // low outlier retained
  });
});
