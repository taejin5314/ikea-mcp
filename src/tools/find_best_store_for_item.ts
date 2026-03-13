import { FindBestStoreInput } from "../schemas/index.js";
import { getStoreStock, projectStock } from "../services/ikea.js";
import { STORE_LABELS, storeLabel, storeIdsByCountry } from "../data/stores.js";
import { pMap } from "../utils/http.js";

export const findBestStoreForItemTool = {
  name: "find_best_store_for_item",
  description:
    "Find stores with the highest in-stock quantity for an item. Returns up to maxResults stores sorted by quantity descending. Optionally filter by countryCode ('US' or 'CA'). Explicit storeIds take precedence over countryCode.",
  inputSchema: {
    type: "object",
    properties: {
      itemNo: { type: "string" },
      storeIds: { type: "array", items: { type: "string" } },
      maxResults: { type: "number", default: 3 },
      countryCode: { type: "string", enum: ["US", "CA"] },
      minQuantity: { type: "number" },
    },
    required: ["itemNo"],
  },
  async handler(rawInput: unknown) {
    const input = FindBestStoreInput.parse(rawInput);
    const targetIds = input.storeIds
      ?? (input.countryCode ? storeIdsByCountry(input.countryCode) : Object.keys(STORE_LABELS));

    const results = await pMap(
      targetIds,
      async (storeId) => {
        const data = await getStoreStock(input.itemNo, storeId, "us");
        const stock = projectStock(data);
        return { storeId, stock };
      },
      10
    );

    const ranked = results
      .filter(
        (r) =>
          r.stock.availableForCashCarry &&
          r.stock.quantity !== null &&
          (input.minQuantity === undefined || r.stock.quantity >= input.minQuantity)
      )
      .sort((a, b) => {
        const diff = (b.stock.quantity ?? 0) - (a.stock.quantity ?? 0);
        return diff !== 0 ? diff : a.storeId.localeCompare(b.storeId);
      })
      .slice(0, input.maxResults)
      .map(({ storeId, stock }) => ({
        storeId,
        storeLabel: storeLabel(storeId) ?? storeId,
        availableForCashCarry: stock.availableForCashCarry,
        quantity: stock.quantity,
        messageType: stock.messageType,
      }));

    return { content: [{ type: "text", text: JSON.stringify(ranked, null, 2) }] };
  },
};
