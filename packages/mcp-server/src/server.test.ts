import { describe, it, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "./server.js";

describe("MCP server", () => {
  let client: Client;

  afterEach(async () => {
    await client?.close();
  });

  async function connectClient(): Promise<Client> {
    const server = createMcpServer("fixture");
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const c = new Client({ name: "test-client", version: "0.0.1" });
    await c.connect(clientTransport);
    return c;
  }

  it("registers search_listings, get_sold_listings, get_supported_marketplaces tools", async () => {
    client = await connectClient();
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("search_listings");
    expect(toolNames).toContain("get_sold_listings");
    expect(toolNames).toContain("get_supported_marketplaces");
  });

  it("search_listings returns JSON array of Listing objects", async () => {
    client = await connectClient();
    const result = await client.callTool({
      name: "search_listings",
      arguments: { query: "Roland Juno-106" },
    });
    const resultContent = (result as { content: Array<{ type: string; text: string }> }).content;
    expect(resultContent).toHaveLength(1);
    const content = resultContent[0] as { type: string; text: string };
    expect(content.type).toBe("text");
    const listings = JSON.parse(content.text) as unknown[];
    expect(Array.isArray(listings)).toBe(true);
    expect(listings.length).toBeGreaterThan(0);
    const first = listings[0] as Record<string, unknown>;
    expect(first.id).toBeTruthy();
    expect(first.marketplace).toBe("fixture");
  });

  it("get_sold_listings returns JSON array of SoldListing objects", async () => {
    client = await connectClient();
    const result = await client.callTool({
      name: "get_sold_listings",
      arguments: { query: "Roland Juno-106", since: "2025-01-01" },
    });
    const resultContent = (result as { content: Array<{ type: string; text: string }> }).content;
    expect(resultContent).toHaveLength(1);
    const content = resultContent[0] as { type: string; text: string };
    expect(content.type).toBe("text");
    const soldListings = JSON.parse(content.text) as unknown[];
    expect(Array.isArray(soldListings)).toBe(true);
    expect(soldListings.length).toBeGreaterThan(0);
    const first = soldListings[0] as Record<string, unknown>;
    expect(first.soldPrice).toBeGreaterThan(0);
    expect(first.soldDate).toBeTruthy();
  });

  it("get_supported_marketplaces returns array containing 'fixture'", async () => {
    client = await connectClient();
    const result = await client.callTool({
      name: "get_supported_marketplaces",
      arguments: {},
    });
    const resultContent = (result as { content: Array<{ type: string; text: string }> }).content;
    expect(resultContent).toHaveLength(1);
    const content = resultContent[0] as { type: string; text: string };
    expect(content.type).toBe("text");
    const marketplaces = JSON.parse(content.text) as string[];
    expect(Array.isArray(marketplaces)).toBe(true);
    expect(marketplaces).toContain("fixture");
  });
});
