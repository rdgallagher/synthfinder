import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Listing, SoldListing } from "@synthfinder/shared";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_SCRIPT = path.resolve(__dirname, "../../../mcp-server/src/index.ts");

export class SynthfinderMcpClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;

  constructor() {
    this.client = new Client({
      name: "synthfinder-agent",
      version: "0.0.1",
    });
  }

  async connect(): Promise<void> {
    this.transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", SERVER_SCRIPT],
      env: {
        ...process.env,
        MARKETPLACE: process.env.MARKETPLACE ?? "fixture",
      },
    });

    await this.client.connect(this.transport);
  }

  async searchListings(query: string): Promise<Listing[]> {
    const result = await this.client.callTool({
      name: "search_listings",
      arguments: { query },
    });

    const textBlock = result.content.find(
      (c): c is { type: "text"; text: string } => c.type === "text",
    );
    if (!textBlock) throw new Error("No text content in search_listings response");

    return JSON.parse(textBlock.text) as Listing[];
  }

  async getSoldListings(query: string, since: Date): Promise<SoldListing[]> {
    const result = await this.client.callTool({
      name: "get_sold_listings",
      arguments: { query, since: since.toISOString() },
    });

    const textBlock = result.content.find(
      (c): c is { type: "text"; text: string } => c.type === "text",
    );
    if (!textBlock) throw new Error("No text content in get_sold_listings response");

    return JSON.parse(textBlock.text) as SoldListing[];
  }

  async close(): Promise<void> {
    await this.client.close();
    await this.transport?.close();
  }
}
