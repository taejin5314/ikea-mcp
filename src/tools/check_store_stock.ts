import { CheckStoreStockInput } from "../schemas/index.js";
import { getStoreStock, projectStock } from "../services/ikea.js";
import { storeLabel } from "../data/stores.js";

export const checkStoreStockTool = {
  name: "check_store_stock",
  description: "Check cash-and-carry stock availability for an item at a specific IKEA store. inRange: false means the item is not sold at that store or in that country's market.",
  inputSchema: {
    type: "object",
    properties: {
      itemNo: { type: "string" },
      storeId: { type: "string" },
      countryCode: { type: "string", default: "US" },
    },
    required: ["itemNo", "storeId"],
  },
  async handler(rawInput: unknown) {
    const input = CheckStoreStockInput.parse(rawInput);
    const result = await getStoreStock(input.itemNo, input.storeId, input.countryCode);
    const output = {
      storeId: input.storeId,
      storeLabel: storeLabel(input.storeId) ?? input.storeId,
      ...projectStock(result),
    };
    return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
  },
};
