import { describe, it, expect, afterEach } from "vitest";
import type { Listing, SoldListing } from "@synthfinder/shared";
import { SynthfinderMcpClient } from "./mcp-client.js";

describe("SynthfinderMcpClient", () => {
  let mcpClient: SynthfinderMcpClient;

  afterEach(async () => {
    if (mcpClient) {
      await mcpClient.close();
    }
  });

  it("connects to MCP server and searches listings", async () => {
    mcpClient = new SynthfinderMcpClient();
    await mcpClient.connect();

    const listings: Listing[] = await mcpClient.searchListings("Roland Juno-106");

    expect(listings.length).toBeGreaterThan(0);
    expect(listings[0].id).toBeTruthy();
    expect(listings[0].marketplace).toBe("fixture");
  });

  it("gets sold listings", async () => {
    mcpClient = new SynthfinderMcpClient();
    await mcpClient.connect();

    const since = new Date("2025-01-01");
    const soldListings: SoldListing[] = await mcpClient.getSoldListings("Roland Juno-106", since);

    expect(soldListings.length).toBeGreaterThan(0);
    expect(soldListings[0].soldPrice).toBeGreaterThan(0);
  });
}, 15000);
