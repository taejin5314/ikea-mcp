import { FindBestStoreForCartInput } from "../schemas/index.js";
import { getMultiItemStock, projectMultiItemStock } from "../services/ikea.js";
import { storeLabel } from "../data/stores.js";
import { resolveTargets } from "./targets.js";
import { pMap } from "../utils/http.js";
import { COUNTRY_CODES } from "../data/countries.js";

export const findBestStoreForCartTool = {
  name: "find_best_store_for_cart",
  description:
    "Find the best store to buy multiple items in one trip. Ranks stores by how many cart items are available in sufficient quantity, then by distance when `near` is given, then by total in-stock sum. Optionally filter by countryCode ('US', 'CA' or 'NO'). Explicit storeIds take precedence over countryCode.",
  inputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            itemNo: { type: "string" },
            quantity: { type: "number", default: 1 },
          },
          required: ["itemNo"],
        },
        minItems: 1,
        maxItems: 20,
      },
      storeIds: { type: "array", items: { type: "string" } },
      countryCode: { type: "string", enum: [...COUNTRY_CODES] },
      near: {
        type: "object",
        description: "Search only the stores closest to this point (the user's city or address). Use this instead of countryCode when you know where the user is.",
        properties: { latitude: { type: "number" }, longitude: { type: "number" } },
        required: ["latitude", "longitude"],
      },
      nearestStores: { type: "number", default: 5, description: "With near: how many of the closest stores to search (1–20)." },
      maxResults: { type: "number", default: 3 },
    },
    required: ["items"],
  },
  async handler(rawInput: unknown) {
    const input = FindBestStoreForCartInput.parse(rawInput);
    const { storeIds: targetIds, distances } = resolveTargets(input);
    const itemNos = input.items.map((i) => i.itemNo);

    const storeResults = await pMap(
      targetIds,
      async (storeId) => {
        const data = await getMultiItemStock(itemNos, storeId);
        const projected = projectMultiItemStock(data, itemNos);
        return { storeId, projected };
      },
      10,
    );

    const scored = storeResults
      .filter((r) => {
        // Exclude stores where a 405 store error hit all items
        const firstErrors = r.projected[0]?.errors ?? [];
        return !firstErrors.some((e) => e.code === 405);
      })
      .map(({ storeId, projected }) => {
        const items = input.items.map((item, i) => {
          const p = projected[i];
          const inStock = p.quantity;
          return {
            itemNo: item.itemNo,
            quantity: item.quantity,
            inStock,
            sufficient: inStock !== null && inStock >= item.quantity,
          };
        });
        const fulfilledCount = items.filter((i) => i.sufficient).length;
        const totalStock = items.reduce((sum, i) => sum + (i.inStock ?? 0), 0);
        return { storeId, fulfilledCount, totalStock, items };
      });

    scored.sort((a, b) => {
      const fc = b.fulfilledCount - a.fulfilledCount;
      if (fc !== 0) return fc;
      // With `near`, among stores that fill the cart equally well the closest comes first.
      const closer = (distances.get(a.storeId) ?? 0) - (distances.get(b.storeId) ?? 0);
      if (closer !== 0) return closer;
      const ts = b.totalStock - a.totalStock;
      if (ts !== 0) return ts;
      return a.storeId.localeCompare(b.storeId);
    });

    const ranked = scored.slice(0, input.maxResults).map(({ storeId, fulfilledCount, totalStock: _ts, items }) => ({
      storeId,
      storeLabel: storeLabel(storeId) ?? storeId,
      allSufficient: fulfilledCount === input.items.length,
      fulfilledCount,
      totalCount: input.items.length,
      ...(distances.has(storeId) ? { distanceKm: distances.get(storeId) } : {}),
      items,
    }));

    return { content: [{ type: "text", text: JSON.stringify(ranked, null, 2) }] };
  },
};
