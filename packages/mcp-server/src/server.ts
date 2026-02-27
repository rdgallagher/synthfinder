import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MarketplaceClient } from "@synthfinder/shared";
import { FixtureMarketplaceClient } from "./marketplaces/fixture-client.js";

function getMarketplaceClient(marketplace: string): MarketplaceClient {
  switch (marketplace) {
    case "fixture":
      return new FixtureMarketplaceClient();
    default:
      throw new Error(`Unknown marketplace: ${marketplace}`);
  }
}

export function createMcpServer(defaultMarketplace: string = "fixture"): McpServer {
  const server = new McpServer({
    name: "synthfinder-mcp-server",
    version: "0.0.1",
  });

  // @ts-expect-error TS2589: MCP SDK's zod schema inference is too deep for tsc; runtime is correct.
  server.tool(
    "search_listings",
    "Search active listings across marketplaces",
    {
      query: z.string().describe("Search query, e.g. 'Roland Juno-106'"),
      marketplace: z.string().optional().describe("Marketplace to search"),
    },
    async (args) => {
      const client = getMarketplaceClient(args.marketplace ?? defaultMarketplace);
      const listings = await client.searchListings(args.query);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(listings) }],
      };
    },
  );

  server.tool(
    "get_sold_listings",
    "Get recently sold listings for price comparison",
    {
      query: z.string().describe("Search query"),
      since: z.string().describe("ISO date string for how far back to look"),
      marketplace: z.string().optional().describe("Marketplace to search"),
    },
    async (args) => {
      const client = getMarketplaceClient(args.marketplace ?? defaultMarketplace);
      const soldListings = await client.getSoldListings(args.query, new Date(args.since));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(soldListings) }],
      };
    },
  );

  server.tool("get_supported_marketplaces", "List available marketplaces", {}, async () => {
    return {
      content: [{ type: "text" as const, text: JSON.stringify([defaultMarketplace]) }],
    };
  });

  return server;
}
