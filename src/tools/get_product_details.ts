import { GetProductDetailsInput } from "../schemas/index.js";
import { getProductDetails } from "../services/ikea.js";

export const getProductDetailsTool = {
  name: "get_product_details",
  description: "Get details for a single IKEA product by item number.",
  inputSchema: {
    type: "object",
    properties: {
      itemNo: { type: "string" },
      countryCode: { type: "string", default: "US", description: "Two-letter country code of the IKEA market to search, e.g. US, CA, NO." },
      langCode: { type: "string", description: "Two-letter language code. Defaults to the country's language: en for US and CA, no for NO." },
    },
    required: ["itemNo"],
  },
  async handler(rawInput: unknown) {
    const input = GetProductDetailsInput.parse(rawInput);
    const output = await getProductDetails(input.itemNo, input.countryCode, input.langCode);
    return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
  },
};
