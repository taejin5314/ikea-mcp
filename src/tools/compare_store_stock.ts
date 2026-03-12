import { CompareStoreStockInput } from "../schemas/index.js";
import { getStoreStock, projectStock } from "../services/ikea.js";
import { storeLabel } from "../data/stores.js";

export const compareStoreStockTool = {
  name: "compare_store_stock",
  description: "Compare stock availability for an item across multiple IKEA stores.",
  inputSchema: {
    type: "object",
    properties: {
      itemNo: { type: "string" },
      storeIds: { type: "array", items: { type: "string" }, minItems: 2 },
      countryCode: { type: "string", default: "us" },
    },
    required: ["itemNo", "storeIds"],
  },
  async handler(rawInput: unknown) {
    const input = CompareStoreStockInput.parse(rawInput);
    const results = await Promise.all(
      input.storeIds.map((storeId) =>
        getStoreStock(input.itemNo, storeId, input.countryCode).then((data) => {
          const label = storeLabel(storeId);
          return {
            storeId,
            ...(label ? { storeLabel: label } : {}),
            ...projectStock(data),
          };
        })
      )
    );
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  },
};
