import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { searchProductsTool } from "./tools/search_products.js";
import { checkStoreStockTool } from "./tools/check_store_stock.js";
import { compareStoreStockTool } from "./tools/compare_store_stock.js";
import { findBestStoreForItemTool } from "./tools/find_best_store_for_item.js";
import { getProductDetailsTool } from "./tools/get_product_details.js";

const tools = [searchProductsTool, checkStoreStockTool, compareStoreStockTool, findBestStoreForItemTool, getProductDetailsTool];

export function createServer(): Server {
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

  return server;
}
