import { ListStoresInput } from "../schemas/index.js";
import { STORES, storeLabelFor } from "../data/stores.js";
import { COUNTRY_CODES } from "../data/countries.js";

export const listStoresTool = {
  name: "list_stores",
  description:
    "List known IKEA store IDs and display names. Use countryCode ('US', 'CA' or 'NO') to filter by country, or omit to return all stores. Use the returned storeId values with the stock tools.",
  inputSchema: {
    type: "object",
    properties: {
      countryCode: { type: "string", enum: [...COUNTRY_CODES] },
    },
  },
  async handler(rawInput: unknown) {
    const input = ListStoresInput.parse(rawInput);
    const records = input.countryCode
      ? STORES.filter((s) => s.countryCode === input.countryCode)
      : STORES;
    const stores = records.map((s) => ({
      storeId: s.storeId,
      storeLabel: storeLabelFor(s),
      countryCode: s.countryCode,
    }));
    return { content: [{ type: "text", text: JSON.stringify({ stores }, null, 2) }] };
  },
};
