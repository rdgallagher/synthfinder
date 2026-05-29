import type { NextRequest } from "next/server";
import type { ScoredListing } from "@synthfinder/shared";
import { SynthfinderMcpClient } from "../../../lib/mcp-client";
import { normalize } from "../../../lib/normalizer";
import { score } from "../../../lib/scorer";
import { scan } from "../../../lib/scan";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { model?: unknown };
  if (typeof body.model !== "string" || body.model.trim() === "") {
    return new Response(JSON.stringify({ error: "model is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const model = body.model;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const mcpClient = new SynthfinderMcpClient();

      try {
        await mcpClient.connect();
        await scan({
          watchlist: [{ model }],
          searchListings: (q) => mcpClient.searchListings(q),
          getSoldListings: (q, since) => mcpClient.getSoldListings(q, since),
          normalize,
          score,
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
