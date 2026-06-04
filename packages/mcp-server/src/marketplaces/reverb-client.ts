import type { Listing, SoldListing, MarketplaceClient } from "@synthfinder/shared";

const REVERB_API_BASE = "https://api.reverb.com/api";

interface ReverbPhoto {
  _links: {
    full?: { href: string };
  };
}

interface ReverbListing {
  id: number;
  title: string;
  description: string;
  price: {
    amount: string;
    amount_cents: number;
    currency: string;
  };
  condition: {
    display_name: string;
  };
  _links: {
    web: { href: string };
  };
  photos: ReverbPhoto[];
  published_at: string;
}

interface ReverbSearchResponse {
  listings: ReverbListing[];
  total: number;
  current_page: number;
  per_page: number;
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

function buildParams(fields: Record<string, string>): string {
  const params = new URLSearchParams({
    ...fields,
    product_type: "keyboards-and-synths",
    category: "synths",
  });
  return params.toString();
}

function mapListing(raw: ReverbListing): Listing {
  const imageUrl = raw.photos[0]?._links.full?.href;
  return {
    id: String(raw.id),
    title: raw.title,
    description: raw.description,
    price: raw.price.amount_cents,
    condition: raw.condition.display_name,
    url: raw._links.web.href,
    marketplace: "reverb",
    ...(imageUrl ? { imageUrl } : {}),
  };
}

function toIsoDate(isoString: string): string {
  return isoString.slice(0, 10); // "2026-01-15T09:00:00Z" → "2026-01-15"
}

export class ReverbMarketplaceClient implements MarketplaceClient {
  readonly name = "reverb";

  constructor(
    private readonly apiKey: string,
    private readonly fetch: Fetcher = globalThis.fetch,
  ) {}

  async searchListings(query: string): Promise<Listing[]> {
    const perPage = 50;
    const all: Listing[] = [];
    let page = 1;

    while (true) {
      const url = `${REVERB_API_BASE}/listings?${buildParams({ query, per_page: String(perPage), page: String(page) })}`;
      const data = await this.get<ReverbSearchResponse>(url);
      all.push(...data.listings.map(mapListing));
      if (data.listings.length < perPage) break;
      page++;
    }

    return all;
  }

  async getSoldListings(query: string, since: Date): Promise<SoldListing[]> {
    const url = `${REVERB_API_BASE}/listings?${buildParams({ query, state: "sold", per_page: "50" })}`;
    const data = await this.get<ReverbSearchResponse>(url);
    return data.listings
      // TODO(smoke-test): verify published_at is the correct field for sold date — may need ended_at or updated_at
      .filter((raw) => new Date(raw.published_at) >= since)
      .map((raw) => ({
        ...mapListing(raw),
        soldPrice: raw.price.amount_cents,
        soldDate: toIsoDate(raw.published_at),
      }));
  }

  private async get<T>(url: string): Promise<T> {
    const response = await this.fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/hal+json",
        "Accept-Version": "3.0",
      },
    });
    if (!response.ok) {
      throw new Error(`Reverb API error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }
}
