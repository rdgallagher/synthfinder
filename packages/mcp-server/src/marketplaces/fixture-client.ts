import type { Listing, SoldListing, MarketplaceClient } from "@synthfinder/shared";
import { JUNO_106_LISTINGS, JUNO_106_SOLD_LISTINGS } from "./fixture-data.js";

export class FixtureMarketplaceClient implements MarketplaceClient {
  readonly name = "fixture";

  async searchListings(_query: string): Promise<Listing[]> {
    return JUNO_106_LISTINGS;
  }

  async getSoldListings(_query: string, _since: Date): Promise<SoldListing[]> {
    return JUNO_106_SOLD_LISTINGS;
  }
}
