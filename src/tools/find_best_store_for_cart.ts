import { FindBestStoreForCartInput } from "../schemas/index.js";
import { getMultiItemStock, projectMultiItemStock } from "../services/ikea.js";
import { STORE_LABELS, storeLabel, storeIdsByCountry } from "../data/stores.js";
import { pMap } from "../utils/http.js";

export const findBestStoreForCartTool = {
  name: "find_best_store_for_cart",
  description:
    "Find the best store to buy multiple items in one trip. Ranks stores by how many cart items are available in sufficient quantity, then by total in-stock sum. Optionally filter by countryCode ('US' or 'CA'). Explicit storeIds take precedence over countryCode.",
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
      countryCode: { type: "string", enum: ["US", "CA"] },
      maxResults: { type: "number", default: 3 },
    },
    required: ["items"],
  },
  async handler(rawInput: unknown) {
    const input = FindBestStoreForCartInput.parse(rawInput);
    const targetIds = input.storeIds
      ?? (input.countryCode ? storeIdsByCountry(input.countryCode) : Object.keys(STORE_LABELS));
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
      items,
    }));

    return { content: [{ type: "text", text: JSON.stringify(ranked, null, 2) }] };
  },
};
