/**
 * Format a price given in whole cents as a USD dollar string.
 *
 * Uses Intl.NumberFormat so the result is always zero-padded to two decimals,
 * grouped with thousands separators, and correctly signed for negative amounts.
 *
 * e.g. 1234 -> "$12.34", 1205 -> "$12.05", 5 -> "$0.05", -50 -> "-$0.50"
 */
export function formatPriceFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}
