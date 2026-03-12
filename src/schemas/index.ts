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
  storeIds: z.array(z.string().min(1)).min(2).max(10),
  countryCode: z.string().length(2).default("us"),
});

export const FindBestStoreInput = z.object({
  itemNo: z.string().min(1),
  storeIds: z.array(z.string().min(1)).optional(),
  maxResults: z.number().int().min(1).max(10).default(3),
});

export const GetProductDetailsInput = z.object({
  itemNo: z.string().min(1),
  countryCode: z.string().length(2).default("us"),
  langCode: z.string().length(2).default("en"),
});

export type SearchProductsInputType = z.infer<typeof SearchProductsInput>;
export type CheckStoreStockInputType = z.infer<typeof CheckStoreStockInput>;
export type CompareStoreStockInputType = z.infer<typeof CompareStoreStockInput>;
export type FindBestStoreInputType = z.infer<typeof FindBestStoreInput>;
export type GetProductDetailsInputType = z.infer<typeof GetProductDetailsInput>;
