import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SynthfinderMcpClient } from "./mcp-client.js";
import { analyzeListings } from "./analyzer.js";
import { scan } from "./scan.js";

const reverbKey = process.env.REVERB_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

describe.skipIf(!reverbKey || !anthropicKey)("scan (E2E integration)", () => {
  let mcpClient: SynthfinderMcpClient;

  beforeAll(async () => {
    mcpClient = new SynthfinderMcpClient();
    await mcpClient.connect();
  });

  afterAll(async () => {
    await mcpClient.close();
  });

  it(
    "runs the full pipeline with real APIs and returns valid scored listings",
    async () => {
      const reports = await scan({
        watchlist: [{ model: "Roland Juno-106" }],
        // Limit to 2 listings so the test stays fast without skipping any
        // part of the stack: MCP connect, Reverb search, Anthropic normalize+score
        searchListings: async (q) => (await mcpClient.searchListings(q)).slice(0, 2),
        getSoldListings: (q, since) => mcpClient.getSoldListings(q, since),
        analyzeListings,
      });

      expect(reports).toHaveLength(1);

      const { scoredListings } = reports[0];
      expect(scoredListings.length).toBeGreaterThan(0);

      for (const result of scoredListings) {
        expect(["strong-bargain", "fair-deal", "overpriced"]).toContain(result.dealTier);
        expect(result.normalizedListing.price).toBeGreaterThan(0);
        expect(result.comparables).toBeTruthy();
        expect(result.normalizedListing.originalListing.id).toBeTruthy();
        expect(result.normalizedListing.originalListing.url).toContain("reverb.com");
      }
    },
    120_000,
  );
});
