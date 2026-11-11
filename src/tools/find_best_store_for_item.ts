import { FindBestStoreInput } from "../schemas/index.js";
import { getStoreStock, projectStock } from "../services/ikea.js";
import { storeLabel } from "../data/stores.js";
import { resolveTargets } from "./targets.js";
import { pMap } from "../utils/http.js";
import { COUNTRY_CODES } from "../data/countries.js";

export const findBestStoreForItemTool = {
  name: "find_best_store_for_item",
  description:
    "Find stores with the highest in-stock quantity for an item. Returns up to maxResults stores sorted by quantity descending, or nearest first when `near` is given. Optionally filter by countryCode ('US', 'CA' or 'NO'). Explicit storeIds take precedence over countryCode.",
  inputSchema: {
    type: "object",
    properties: {
      itemNo: { type: "string" },
      storeIds: { type: "array", items: { type: "string" } },
      maxResults: { type: "number", default: 3 },
      countryCode: { type: "string", enum: [...COUNTRY_CODES] },
      near: {
        type: "object",
        description: "Search only the stores closest to this point (the user's city or address). Use this instead of countryCode when you know where the user is.",
        properties: { latitude: { type: "number" }, longitude: { type: "number" } },
        required: ["latitude", "longitude"],
      },
      nearestStores: { type: "number", default: 5, description: "With near: how many of the closest stores to search (1–20)." },
      minQuantity: { type: "number" },
    },
    required: ["itemNo"],
  },
  async handler(rawInput: unknown) {
    const input = FindBestStoreInput.parse(rawInput);
    const { storeIds: targetIds, distances } = resolveTargets(input);

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
        // With `near`, any store that has the item is good enough, so the closest comes first.
        const closer = (distances.get(a.storeId) ?? 0) - (distances.get(b.storeId) ?? 0);
        if (closer !== 0) return closer;
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
        ...(distances.has(storeId) ? { distanceKm: distances.get(storeId) } : {}),
      }));

    return { content: [{ type: "text", text: JSON.stringify(ranked, null, 2) }] };
  },
};
