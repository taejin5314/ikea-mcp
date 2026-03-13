import { CompareStoreStockInput } from "../schemas/index.js";
import { getStoreStock, projectStock } from "../services/ikea.js";
import { storeLabel, storeIdsByCountry } from "../data/stores.js";

export const compareStoreStockTool = {
  name: "compare_store_stock",
  description:
    "Compare stock availability for an item across multiple IKEA stores. Provide explicit storeIds, or use countryCode ('US' or 'CA') to compare all catalog stores for that country.",
  inputSchema: {
    type: "object",
    properties: {
      itemNo: { type: "string" },
      storeIds: { type: "array", items: { type: "string" }, minItems: 2 },
      countryCode: { type: "string", enum: ["US", "CA"] },
    },
    required: ["itemNo"],
  },
  async handler(rawInput: unknown) {
    const input = CompareStoreStockInput.parse(rawInput);
    const targetIds = input.storeIds
      ?? storeIdsByCountry(input.countryCode as "US" | "CA");
    const apiCountry = input.countryCode?.toLowerCase() ?? "us";
    const results = await Promise.all(
      targetIds.map((storeId) =>
        getStoreStock(input.itemNo, storeId, apiCountry).then((data) => {
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
