import { CompareStoreStockInput } from "../schemas/index.js";
import { getStoreStock, projectStock } from "../services/ikea.js";
import { storeLabel, storeIdsByCountry } from "../data/stores.js";
import { pMap } from "../utils/http.js";

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
      sortBy: { type: "string", enum: ["quantity", "storeId"] },
    },
    required: ["itemNo"],
  },
  async handler(rawInput: unknown) {
    const input = CompareStoreStockInput.parse(rawInput);
    const targetIds = input.storeIds
      ?? storeIdsByCountry(input.countryCode as "US" | "CA");
    const apiCountry = input.countryCode?.toLowerCase() ?? "us";
    const results = await pMap(
      targetIds,
      (storeId) =>
        getStoreStock(input.itemNo, storeId, apiCountry).then((data) => ({
          storeId,
          storeLabel: storeLabel(storeId) ?? storeId,
          ...projectStock(data),
        })),
      10
    );
    if (input.sortBy === "quantity") {
      results.sort((a, b) => {
        const diff = (b.quantity ?? -Infinity) - (a.quantity ?? -Infinity);
        return diff !== 0 ? diff : a.storeId.localeCompare(b.storeId);
      });
    } else if (input.sortBy === "storeId") {
      results.sort((a, b) => a.storeId.localeCompare(b.storeId));
    }
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  },
};
