import { GetProductDetailsInput } from "../schemas/index.js";
import { getProductDetails } from "../services/ikea.js";

export const getProductDetailsTool = {
  name: "get_product_details",
  description: "Get details for a single IKEA product by item number.",
  inputSchema: {
    type: "object",
    properties: {
      itemNo: { type: "string" },
      countryCode: { type: "string", default: "us" },
      langCode: { type: "string", default: "en" },
    },
    required: ["itemNo"],
  },
  async handler(rawInput: unknown) {
    const input = GetProductDetailsInput.parse(rawInput);
    const output = await getProductDetails(input.itemNo, input.countryCode, input.langCode);
    return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
  },
};
