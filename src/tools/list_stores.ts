import { ListStoresInput } from "../schemas/index.js";
import { STORE_LABELS, storeLabel, storeIdsByCountry } from "../data/stores.js";

export const listStoresTool = {
  name: "list_stores",
  description:
    "List known IKEA store IDs and display names. Use countryCode ('US' or 'CA') to filter by country, or omit to return all stores.",
  inputSchema: {
    type: "object",
    properties: {
      countryCode: { type: "string", enum: ["US", "CA"] },
    },
  },
  async handler(rawInput: unknown) {
    const input = ListStoresInput.parse(rawInput);

    const storeIds = input.countryCode
      ? storeIdsByCountry(input.countryCode)
      : Object.keys(STORE_LABELS);

    // When returning all stores, build a CA set for tagging.
    const caSet =
      input.countryCode === "CA"
        ? new Set(storeIds)
        : input.countryCode === "US"
          ? new Set<string>()
          : new Set(storeIdsByCountry("CA"));

    const stores = storeIds.map((storeId) => ({
      storeId,
      storeLabel: storeLabel(storeId) ?? storeId,
      countryCode: caSet.has(storeId) ? ("CA" as const) : ("US" as const),
    }));

    return { content: [{ type: "text", text: JSON.stringify({ stores }, null, 2) }] };
  },
};
