import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";

const marketplace = process.env.MARKETPLACE ?? "fixture";
const server = createMcpServer(marketplace);
const transport = new StdioServerTransport();
await server.connect(transport);
