import type { WatchlistItem } from "@synthfinder/shared";
import { scan } from "../src/lib/scan.js";
import { SynthfinderMcpClient } from "../src/lib/mcp-client.js";
import { normalize } from "../src/lib/normalizer.js";
import { score } from "../src/lib/scorer.js";

const watchlist: WatchlistItem[] = [{ model: "Roland Juno-106" }];

const mcpClient = new SynthfinderMcpClient();
await mcpClient.connect();

try {
  const reports = await scan({
    watchlist,
    searchListings: (query) => mcpClient.searchListings(query),
    getSoldListings: (query, since) => mcpClient.getSoldListings(query, since),
    normalize,
    score,
  });

  console.log(JSON.stringify(reports, null, 2));
} finally {
  await mcpClient.close();
}
