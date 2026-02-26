import type { Listing, SoldListing } from "@synthfinder/shared";

export const JUNO_106_LISTINGS: Listing[] = [
  {
    id: "fix-001",
    title: "Roland JUNO 106 great cond w/ case",
    description:
      "All voices working after recent chip replacement. Includes original hard case. No power cable.",
    price: 120000,
    condition: "great condition",
    url: "https://fixture.test/item/fix-001",
    marketplace: "fixture",
  },
  {
    id: "fix-002",
    title: "Roland Juno-106 - Mint, Original Box",
    description:
      "Pristine condition. All original. Comes with original box and manual. One owner since 1985.",
    price: 185000,
    condition: "mint",
    url: "https://fixture.test/item/fix-002",
    marketplace: "fixture",
  },
  {
    id: "fix-003",
    title: "Juno 106 AS-IS for parts/repair",
    description:
      "Dead voice chips (4 of 6 not working). Cosmetically rough. Selling as-is, no returns. Missing side panel.",
    price: 45000,
    condition: "as-is",
    url: "https://fixture.test/item/fix-003",
    marketplace: "fixture",
  },
  {
    id: "fix-004",
    title: "Roland Juno-106 Analog Synth - Fair Condition",
    description:
      "Works but has sticky keys and some voice chip issues. 2 voices intermittent. Cosmetic wear on panel. Power cable included.",
    price: 75000,
    condition: "fair",
    url: "https://fixture.test/item/fix-004",
    marketplace: "fixture",
  },
];

export const JUNO_106_SOLD_LISTINGS: SoldListing[] = [
  {
    id: "fix-sold-001",
    title: "Roland Juno-106 Good Condition",
    description: "All voices working, some cosmetic wear.",
    price: 110000,
    condition: "good",
    url: "https://fixture.test/item/fix-sold-001",
    marketplace: "fixture",
    soldDate: "2025-12-15",
    soldPrice: 110000,
  },
  {
    id: "fix-sold-002",
    title: "Roland Juno-106 Excellent",
    description: "Recently serviced, all voices perfect.",
    price: 140000,
    condition: "excellent",
    url: "https://fixture.test/item/fix-sold-002",
    marketplace: "fixture",
    soldDate: "2025-11-20",
    soldPrice: 135000,
  },
  {
    id: "fix-sold-003",
    title: "Juno 106 Mint w/ Case",
    description: "Like new. Includes hard case.",
    price: 175000,
    condition: "mint",
    url: "https://fixture.test/item/fix-sold-003",
    marketplace: "fixture",
    soldDate: "2025-10-05",
    soldPrice: 170000,
  },
];
