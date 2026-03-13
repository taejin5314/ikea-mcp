import { z } from "zod";

export const SearchProductsInput = z.object({
  query: z.string().min(1),
  countryCode: z.string().length(2).default("us"),
  langCode: z.string().length(2).default("en"),
  size: z.number().int().min(1).max(50).default(10),
});

export const CheckStoreStockInput = z.object({
  itemNo: z.string().min(1),
  storeId: z.string().min(1),
  countryCode: z.string().length(2).default("us"),
});

export const CompareStoreStockInput = z.object({
  itemNo: z.string().min(1),
  storeIds: z.array(z.string().min(1)).min(2).max(10).optional(),
  countryCode: z.enum(["US", "CA"]).optional(),
}).refine(
  (d) => d.storeIds !== undefined || d.countryCode !== undefined,
  { message: "provide storeIds or countryCode" }
);

export const FindBestStoreInput = z.object({
  itemNo: z.string().min(1),
  storeIds: z.array(z.string().min(1)).optional(),
  maxResults: z.number().int().min(1).max(10).default(3),
  countryCode: z.enum(["US", "CA"]).optional(),
});

export const GetProductDetailsInput = z.object({
  itemNo: z.string().min(1),
  countryCode: z.string().length(2).default("us"),
  langCode: z.string().length(2).default("en"),
});

export const CheckMultiItemStockInput = z.object({
  storeId: z.string().min(1),
  itemNos: z.array(z.string().min(1)).min(1).max(20),
});

export type SearchProductsInputType = z.infer<typeof SearchProductsInput>;
export type CheckStoreStockInputType = z.infer<typeof CheckStoreStockInput>;
export type CompareStoreStockInputType = z.infer<typeof CompareStoreStockInput>;
export type FindBestStoreInputType = z.infer<typeof FindBestStoreInput>;
export type GetProductDetailsInputType = z.infer<typeof GetProductDetailsInput>;
export type CheckMultiItemStockInputType = z.infer<typeof CheckMultiItemStockInput>;
