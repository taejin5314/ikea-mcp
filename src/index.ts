import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { searchProductsTool } from "./tools/search_products.js";
import { checkStoreStockTool } from "./tools/check_store_stock.js";
import { compareStoreStockTool } from "./tools/compare_store_stock.js";

const tools = [searchProductsTool, checkStoreStockTool, compareStoreStockTool];

const server = new Server(
  { name: "ikea-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = tools.find((t) => t.name === req.params.name);
  if (!tool) {
    throw new Error(`Unknown tool: ${req.params.name}`);
  }
  return tool.handler(req.params.arguments);
});

const transport = new StdioServerTransport();
await server.connect(transport);
