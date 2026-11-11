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
import { toToolError } from "./utils/errors.js";

// The version the server reports is the package version, read from package.json next to dist/ (or src/ in dev).
const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

// The version the server reports is the package version, read from package.json next to dist/ (or src/ in dev).
const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

const tools = [listStoresTool, searchProductsTool, checkStoreStockTool, compareStoreStockTool, findBestStoreForItemTool, getProductDetailsTool, checkMultiItemStockTool, checkCartAvailabilityTool, findBestStoreForCartTool];

// Every tool only reads. All but list_stores call the live IKEA API, so their answers can change between calls.
const TITLES: Record<string, string> = {
  list_stores: "List IKEA stores",
  search_products: "Search IKEA products",
  get_product_details: "Get IKEA product details",
  check_store_stock: "Check stock at one store",
  check_multi_item_stock: "Check several items at one store",
  compare_store_stock: "Compare stock across stores",
  find_best_store_for_item: "Find the best store for an item",
  check_cart_availability: "Check a shopping list at one store",
  find_best_store_for_cart: "Find the best store for a shopping list",
};

export function listTools() {
  return tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
    annotations: {
      title: TITLES[name],
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: name !== "list_stores",
    },
  }));
}

/**
 * Runs one tool. An unknown tool name is a protocol error; anything a known tool throws (bad input, an upstream
 * failure) comes back as a tool result with isError set, so the model can read it and correct the call.
 */
export async function callTool(name: string, args: unknown) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  try {
    return await tool.handler(args);
  } catch (err) {
    return toToolError(name, err);
  }
}

export function createServer(): Server {
  const server = new Server(
    { name: "ikea-mcp", version },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listTools() }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => callTool(req.params.name, req.params.arguments));

  return server;
}
