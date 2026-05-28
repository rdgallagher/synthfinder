import { mkdirSync, writeFileSync } from "node:fs";
import type { WatchlistItem } from "@synthfinder/shared";
import { scan } from "../src/lib/scan.js";
import { SynthfinderMcpClient } from "../src/lib/mcp-client.js";
import { normalize } from "../src/lib/normalizer.js";
import { score } from "../src/lib/scorer.js";
import { createLogger } from "../src/lib/logger.js";

const watchlist: WatchlistItem[] = [{ model: process.env.MODEL ?? "Roland Juno-106" }];

const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
mkdirSync("output", { recursive: true });

const logPath = `output/scan-${timestamp}.log`;
const outputPath = `output/scan-${timestamp}.json`;
const debugEnabled = process.env.LOG_LEVEL === "debug";
const logger = createLogger(logPath, debugEnabled);

const mcpClient = new SynthfinderMcpClient();
await mcpClient.connect();

try {
  const reports = await scan({
    watchlist,
    searchListings: (query) => mcpClient.searchListings(query),
    getSoldListings: (query, since) => mcpClient.getSoldListings(query, since),
    normalize: (listing) => normalize(listing, logger.debug),
    score: (normalized, soldListings) => score(normalized, soldListings, logger.debug),
    log: logger.log,
  });

  writeFileSync(outputPath, JSON.stringify(reports, null, 2));
  logger.log(`Log:    ${logPath}`);
  logger.log(`Output: ${outputPath}`);
} finally {
  await mcpClient.close();
}
