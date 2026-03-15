import { SearchProductsInput } from "../schemas/index.js";
import { searchProducts, type SearchResponse } from "../services/ikea.js";

export const searchProductsTool = {
  name: "search_products",
  description: "Search IKEA products by keyword.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      countryCode: { type: "string", default: "us" },
      langCode: { type: "string", default: "en" },
      size: { type: "number", default: 10 },
    },
    required: ["query"],
  },
  async handler(rawInput: unknown) {
    const input = SearchProductsInput.parse(rawInput);
    const result: SearchResponse = await searchProducts(
      input.query,
      input.countryCode,
      input.langCode,
      input.size
    );
    const main = result.searchResultPage.products.main;
    const output = {
      total: main.max,
      items: main.items.filter((i) => i.product != null).map(({ product: p }) => ({
        itemNo: p.itemNo,
        name: p.name,
        typeName: p.typeName,
        salesPrice: { amount: p.salesPrice.numeral, currencyCode: p.salesPrice.currencyCode },
        pipUrl: p.pipUrl,
        imageUrl: p.mainImageUrl,
        ratingValue: p.ratingValue,
        ratingCount: p.ratingCount,
      })),
    };
    return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
  },
};
