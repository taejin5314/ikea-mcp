import { CheckStoreStockInput } from "../schemas/index.js";
import { getStoreStock, projectStock } from "../services/ikea.js";
import { storeLabel } from "../data/stores.js";

export const checkStoreStockTool = {
  name: "check_store_stock",
  description: "Check stock availability for an item at a specific IKEA store.",
  inputSchema: {
    type: "object",
    properties: {
      itemNo: { type: "string" },
      storeId: { type: "string" },
      countryCode: { type: "string", default: "us" },
    },
    required: ["itemNo", "storeId"],
  },
  async handler(rawInput: unknown) {
    const input = CheckStoreStockInput.parse(rawInput);
    const result = await getStoreStock(input.itemNo, input.storeId, input.countryCode);
    const label = storeLabel(input.storeId);
    const output = {
      storeId: input.storeId,
      ...(label ? { storeLabel: label } : {}),
      ...projectStock(result),
    };
    return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
  },
};
