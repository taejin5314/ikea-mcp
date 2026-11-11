import { z } from "zod";
import { COUNTRY_CODES, defaultLangCode } from "../data/countries.js";

// ── normalizeItemNo ───────────────────────────────────────────────────────────

/**
 * Strips non-digit characters, then left-pads to 8 digits when the result is
 * 6 or 7 digits long. 8- and 9-digit results are kept as-is. All other lengths
 * are left unchanged and will be rejected by the downstream Zod regex.
 *
 * Exported so it can be unit-tested independently.
 */
export function normalizeItemNo(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 6 || digits.length === 7
    ? digits.padStart(8, "0")
    : digits;
}

// Zod schema for a single IKEA item number.
// Accepts dotted ("005.221.32"), hyphenated ("5-221-32"), and plain ("522132") inputs.
// Rejects empty strings, <6-digit results, and >9-digit results.
const ItemNo = z
  .string()
  .transform(normalizeItemNo)
  .pipe(
    z
      .string()
      .regex(
        /^\d{8,9}$/,
        "itemNo must resolve to 8 or 9 digits after stripping non-digit characters"
      )
  );

// ── countryCode helpers ───────────────────────────────────────────────────────

const toUpper = (v: unknown): unknown =>
  typeof v === "string" ? v.toUpperCase() : v;

// Free-form 2-letter ISO country code normalised to uppercase.
// Used by search and product-detail tools that accept any country code.
const CountryCode2 = z.preprocess(toUpper, z.string().length(2));

// Uppercase-normalised enum restricted to the countries in the store catalog.
// Accepts "us"/"ca"/"no" and normalises to "US"/"CA"/"NO".
const CountryCodeEnum = z.preprocess(toUpper, z.enum(COUNTRY_CODES));

// Two-letter language code for the search API. Optional on input; filled from the
// country's default (see defaultLangCode) when omitted.
const LangCode = z.string().length(2);

// ── Input schemas ─────────────────────────────────────────────────────────────

export const SearchProductsInput = z
  .object({
    query: z.string().min(1),
    countryCode: CountryCode2.default("US"),
    langCode: LangCode.optional(),
    size: z.number().int().min(1).max(50).default(10),
  })
  .transform((d) => ({ ...d, langCode: d.langCode ?? defaultLangCode(d.countryCode) }));

export const CheckStoreStockInput = z.object({
  itemNo: ItemNo,
  storeId: z.string().min(1),
  countryCode: CountryCode2.default("US"),
});

export const CompareStoreStockInput = z
  .object({
    itemNo: ItemNo,
    storeIds: z.array(z.string().min(1)).min(2).max(10).optional(),
    countryCode: CountryCodeEnum.optional(),
    sortBy: z.enum(["quantity", "storeId"]).optional(),
  })
  .refine(
    (d) => d.storeIds !== undefined || d.countryCode !== undefined,
    { message: "provide storeIds or countryCode" }
  );

export const ListStoresInput = z.object({
  countryCode: CountryCodeEnum.optional(),
});

// A point on the map: the user's city or address, in decimal degrees.
const Near = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
const NearestStores = z.number().int().min(1).max(20).default(5);

export const FindNearbyStoresInput = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  countryCode: CountryCodeEnum.optional(),
  maxResults: z.number().int().min(1).max(20).default(5),
  maxDistanceKm: z.number().positive().optional(),
});

export const FindBestStoreInput = z.object({
  itemNo: ItemNo,
  storeIds: z.array(z.string().min(1)).optional(),
  maxResults: z.number().int().min(1).max(50).default(3),
  countryCode: CountryCodeEnum.optional(),
  near: Near.optional(),
  nearestStores: NearestStores,
  minQuantity: z.number().int().min(1).optional(),
});

export const GetProductDetailsInput = z
  .object({
    itemNo: ItemNo,
    countryCode: CountryCode2.default("US"),
    langCode: LangCode.optional(),
  })
  .transform((d) => ({ ...d, langCode: d.langCode ?? defaultLangCode(d.countryCode) }));

export const CheckMultiItemStockInput = z.object({
  storeId: z.string().min(1),
  itemNos: z.array(ItemNo).min(1).max(20),
});

export const CheckCartAvailabilityInput = z.object({
  storeId: z.string().min(1),
  items: z.array(
    z.object({
      itemNo: ItemNo,
      quantity: z.number().int().min(1).max(99).default(1),
    })
  ).min(1).max(20),
});

export const FindBestStoreForCartInput = z.object({
  items: z.array(
    z.object({
      itemNo: ItemNo,
      quantity: z.number().int().min(1).max(99).default(1),
    })
  ).min(1).max(20),
  storeIds: z.array(z.string().min(1)).optional(),
  countryCode: CountryCodeEnum.optional(),
  near: Near.optional(),
  nearestStores: NearestStores,
  maxResults: z.number().int().min(1).max(50).default(3),
});

export type ListStoresInputType = z.infer<typeof ListStoresInput>;
export type SearchProductsInputType = z.infer<typeof SearchProductsInput>;
export type CheckStoreStockInputType = z.infer<typeof CheckStoreStockInput>;
export type CompareStoreStockInputType = z.infer<typeof CompareStoreStockInput>;
export type FindBestStoreInputType = z.infer<typeof FindBestStoreInput>;
export type GetProductDetailsInputType = z.infer<typeof GetProductDetailsInput>;
export type CheckMultiItemStockInputType = z.infer<typeof CheckMultiItemStockInput>;
export type CheckCartAvailabilityInputType = z.infer<typeof CheckCartAvailabilityInput>;
export type FindBestStoreForCartInputType = z.infer<typeof FindBestStoreForCartInput>;
