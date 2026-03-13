import { CheckMultiItemStockInput } from "../schemas/index.js";
import { getMultiItemStock, projectMultiItemStock } from "../services/ikea.js";
import { storeLabel } from "../data/stores.js";

export const checkMultiItemStockTool = {
  name: "check_multi_item_stock",
  description: "Check cash-and-carry stock for multiple items at a single IKEA store.",
  inputSchema: {
    type: "object",
    properties: {
      storeId: { type: "string" },
      itemNos: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20 },
    },
    required: ["storeId", "itemNos"],
  },
  async handler(rawInput: unknown) {
    const input = CheckMultiItemStockInput.parse(rawInput);
    const result = await getMultiItemStock(input.itemNos, input.storeId);
    const label = storeLabel(input.storeId);
    const rows = projectMultiItemStock(result, input.itemNos).map((row) => ({
      itemNo: row.itemNo,
      storeId: input.storeId,
      ...(label ? { storeLabel: label } : {}),
      availableForCashCarry: row.availableForCashCarry,
      quantity: row.quantity,
      messageType: row.messageType,
      errors: row.errors,
    }));
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  },
};
