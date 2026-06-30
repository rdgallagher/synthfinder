/**
 * Format a price given in whole cents as a dollar string.
 * e.g. 1234 -> "$12.34"
 */
export function formatPriceFromCents(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return `$${dollars}.${remainder}`;
}
