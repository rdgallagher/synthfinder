import type { NextRequest } from "next/server";
import type { ScoredListing } from "@synthfinder/shared";
import { SynthfinderMcpClient } from "../../../lib/mcp-client.js";
import { normalize } from "../../../lib/normalizer.js";
import { score } from "../../../lib/scorer.js";
import { scan } from "../../../lib/scan.js";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { model } = (await request.json()) as { model: string };
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const mcpClient = new SynthfinderMcpClient();
      await mcpClient.connect();

      try {
        await scan({
          watchlist: [{ model }],
          searchListings: (q) => mcpClient.searchListings(q),
          getSoldListings: (q, since) => mcpClient.getSoldListings(q, since),
          normalize: (listing) => normalize(listing),
          score: (normalized, soldListings) => score(normalized, soldListings),
          log: (message) => send("progress", { message }),
          onListing: (listing: ScoredListing) => send("result", { listing }),
        });
      } catch (err) {
        send("error", { message: String(err) });
      } finally {
        await mcpClient.close();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
