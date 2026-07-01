import { describe, it, expect } from "vitest";
import { formatPriceFromCents } from "./format-price.js";

describe("formatPriceFromCents", () => {
  it.each([
    [1234, "$12.34"],
    [1205, "$12.05"], // sub-dime remainder must be zero-padded
    [1200, "$12.00"], // whole dollars keep two decimals
    [5, "$0.05"],
    [0, "$0.00"],
    [99, "$0.99"],
    [100, "$1.00"],
    [123456, "$1,234.56"], // thousands separator
  ])("formats %i cents as %s", (cents, expected) => {
    expect(formatPriceFromCents(cents)).toBe(expected);
  });

  it("formats negative cents with a leading minus sign", () => {
    expect(formatPriceFromCents(-50)).toBe("-$0.50");
    expect(formatPriceFromCents(-1205)).toBe("-$12.05");
  });
});
