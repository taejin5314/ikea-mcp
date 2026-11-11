import { createRequire } from "node:module";
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
import { checkMultiItemStockTool } from "./tools/check_multi_item_stock.js";
import { listStoresTool } from "./tools/list_stores.js";
import { checkCartAvailabilityTool } from "./tools/check_cart_availability.js";
import { findBestStoreForCartTool } from "./tools/find_best_store_for_cart.js";

// The version the server reports is the package version, read from package.json next to dist/ (or src/ in dev).
const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

const tools = [listStoresTool, searchProductsTool, checkStoreStockTool, compareStoreStockTool, findBestStoreForItemTool, getProductDetailsTool, checkMultiItemStockTool, checkCartAvailabilityTool, findBestStoreForCartTool];

export function createServer(): Server {
  const server = new Server(
    { name: "ikea-mcp", version },
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
