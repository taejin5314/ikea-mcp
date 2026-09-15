import { CompareStoreStockInput } from "../schemas/index.js";
import { getStoreStock, projectStock } from "../services/ikea.js";
import { storeLabel, storeIdsByCountry } from "../data/stores.js";
import { pMap } from "../utils/http.js";
import { COUNTRY_CODES, type CountryCode } from "../data/countries.js";

export const compareStoreStockTool = {
  name: "compare_store_stock",
  description:
    "Compare cash-and-carry stock for an item across multiple IKEA stores. Provide explicit storeIds, or use countryCode ('US', 'CA' or 'NO') to compare all catalog stores for that country. inRange: false on a row means the item is not sold at that store or in that country's market.",
  inputSchema: {
    type: "object",
    properties: {
      itemNo: { type: "string" },
      storeIds: { type: "array", items: { type: "string" }, minItems: 2 },
      countryCode: { type: "string", enum: [...COUNTRY_CODES] },
      sortBy: { type: "string", enum: ["quantity", "storeId"] },
    },
    required: ["itemNo"],
  },
  async handler(rawInput: unknown) {
    const input = CompareStoreStockInput.parse(rawInput);
    const targetIds = input.storeIds
      ?? storeIdsByCountry(input.countryCode as CountryCode);
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
