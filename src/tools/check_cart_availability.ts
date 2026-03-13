import { CheckCartAvailabilityInput } from "../schemas/index.js";
import { getMultiItemStock, type StockResponse } from "../services/ikea.js";
import { storeLabel } from "../data/stores.js";

export const checkCartAvailabilityTool = {
  name: "check_cart_availability",
  description:
    "Check whether all items in a shopping list are available in sufficient quantity at a single IKEA store.",
  inputSchema: {
    type: "object",
    properties: {
      storeId: { type: "string" },
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
    },
    required: ["storeId", "items"],
  },
  async handler(rawInput: unknown) {
    const input = CheckCartAvailabilityInput.parse(rawInput);
    const itemNos = input.items.map((i) => i.itemNo);
    const result = await getMultiItemStock(itemNos, input.storeId);

    const byItemNo = new Map<string, NonNullable<StockResponse["availabilities"]>[number]>();
    for (const a of result.availabilities ?? []) {
      byItemNo.set(a.itemKey.itemNo, a);
    }
    const errorByItemNo = new Map<string, { code: number; message: string; meaning: string }>();
    for (const e of result.errors ?? []) {
      if (e.details?.itemNo) {
        errorByItemNo.set(e.details.itemNo, {
          ...e,
          meaning: e.code === 404 ? "item not stocked at this store" : "unknown",
        });
      }
    }
    const storeError = result.errors?.find((e) => e.code === 405);

    const items = input.items.map((item) => {
      if (storeError) {
        return {
          itemNo: item.itemNo,
          quantity: item.quantity,
          inStock: null as number | null,
          sufficient: false,
          eligibleForStockNotification: null as boolean | null,
          errors: [{ code: storeError.code, message: storeError.message, meaning: "store ID does not exist" }],
        };
      }
      const a = byItemNo.get(item.itemNo);
      if (a) {
        const inStock = a.buyingOption.cashCarry.availability.quantity;
        return {
          itemNo: item.itemNo,
          quantity: item.quantity,
          inStock,
          sufficient: inStock >= item.quantity,
          eligibleForStockNotification: a.buyingOption.cashCarry.eligibleForStockNotification ?? null,
          errors: [] as { code: number; message: string; meaning: string }[],
        };
      }
      const err = errorByItemNo.get(item.itemNo);
      return {
        itemNo: item.itemNo,
        quantity: item.quantity,
        inStock: null as number | null,
        sufficient: false,
        eligibleForStockNotification: null as boolean | null,
        errors: err
          ? [err]
          : [{ code: 404, message: "Not found", meaning: "item not stocked at this store" }],
      };
    });

    const allSufficient = items.every((i) => i.sufficient);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          storeId: input.storeId,
          storeLabel: storeLabel(input.storeId) ?? input.storeId,
          allSufficient,
          items,
        }, null, 2),
      }],
    };
  },
};
