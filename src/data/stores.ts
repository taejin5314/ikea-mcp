import type { CountryCode } from "./countries.js";

// US store IDs confirmed from ikea.com/us/en/stores/<slug>/ pages (store_id= survey param).
// CA store IDs confirmed from ikea.com/ca/en/stores/<slug>/ pages (storeNo= embedded JSON).
// NO store IDs confirmed from ikea.com/no/no/stores/<slug>/ pages ("id":"NNN" next to
//   "buClassification" in the embedded JSON), all probed against the stock API 2026-09-15.
// IDs match the sto/{storeId} path used by the IKEA stock API.
// 4-digit IDs (921, 1099, 1129) are newer-format stores — confirmed working with stock API.
// 3136 (San Francisco) returns 405 from stock API — excluded.
// 698 (CA — unknown city) returns 422 from stock API — excluded.
// 659 (Toronto Downtown) returns 200 but null quantity — included conservatively.
// NO non-stock locations (no cash-and-carry range, returned by /ru/no but excluded here):
//   722 IKEA på Karl Johan (Oslo, plan & order point), 1352 IKEA Østfold (SMALL),
//   1213 Ski, 1214 Haugesund, 1215 Ålesund, 1216 Porsgrunn (plan & order points),
//   1217 and 1218 (unknown, no ikea.com page found).
// TODO: huntsville, arcadia, mcallen-pharr, san-marcos (US) — IDs not found on store pages.
// TODO: 448, 612, 634, 652, 661, 663, 692, 693 — valid API IDs, city/country unknown.

export interface StoreRecord {
  storeId: string;
  /** Store name when it differs from the city (Norwegian stores). */
  name?: string;
  city: string;
  /** State or province code (US, CA). */
  region?: string;
  countryCode: CountryCode;
}

export const STORES: readonly StoreRecord[] = [
  // ── United States ────────────────────────────────────────────────────────────
  { storeId: "026", city: "Canton", region: "MI", countryCode: "US" },
  { storeId: "027", city: "Round Rock", region: "TX", countryCode: "US" },
  { storeId: "028", city: "Portland", region: "OR", countryCode: "US" },
  { storeId: "042", city: "Tampa", region: "FL", countryCode: "US" },
  { storeId: "064", city: "Centennial", region: "CO", countryCode: "US" },
  { storeId: "067", city: "Charlotte", region: "NC", countryCode: "US" },
  { storeId: "103", city: "Draper", region: "UT", countryCode: "US" },
  { storeId: "145", city: "Orlando", region: "FL", countryCode: "US" },
  { storeId: "152", city: "Baltimore", region: "MD", countryCode: "US" },
  { storeId: "153", city: "Pittsburgh", region: "PA", countryCode: "US" },
  { storeId: "154", city: "Elizabeth", region: "NJ", countryCode: "US" },
  { storeId: "156", city: "Long Island", region: "NY", countryCode: "US" },
  { storeId: "157", city: "West Sacramento", region: "CA", countryCode: "US" },
  { storeId: "158", city: "Stoughton", region: "MA", countryCode: "US" },
  { storeId: "162", city: "Carson", region: "CA", countryCode: "US" },
  { storeId: "165", city: "Emeryville", region: "CA", countryCode: "US" },
  { storeId: "166", city: "San Diego", region: "CA", countryCode: "US" },
  { storeId: "167", city: "Costa Mesa", region: "CA", countryCode: "US" },
  { storeId: "168", city: "Woodbridge", region: "VA", countryCode: "US" },
  { storeId: "170", city: "Bolingbrook", region: "IL", countryCode: "US" },
  { storeId: "175", city: "West Chester", region: "OH", countryCode: "US" },
  { storeId: "183", city: "Frisco", region: "TX", countryCode: "US" },
  { storeId: "207", city: "Sunrise", region: "FL", countryCode: "US" },
  { storeId: "209", city: "Tempe", region: "AZ", countryCode: "US" },
  { storeId: "210", city: "Schaumburg", region: "IL", countryCode: "US" },
  { storeId: "211", city: "Conshohocken", region: "PA", countryCode: "US" },
  { storeId: "212", city: "Minneapolis", region: "MN", countryCode: "US" },
  { storeId: "213", city: "New Haven", region: "CT", countryCode: "US" },
  { storeId: "215", city: "South Philadelphia", region: "PA", countryCode: "US" },
  { storeId: "257", city: "Atlanta", region: "GA", countryCode: "US" },
  { storeId: "327", city: "Miami", region: "FL", countryCode: "US" },
  { storeId: "347", city: "East Palo Alto", region: "CA", countryCode: "US" },
  { storeId: "374", city: "Merriam", region: "KS", countryCode: "US" },
  { storeId: "379", city: "Houston", region: "TX", countryCode: "US" },
  { storeId: "399", city: "Burbank", region: "CA", countryCode: "US" },
  { storeId: "409", city: "Paramus", region: "NJ", countryCode: "US" },
  { storeId: "410", city: "St. Louis", region: "MO", countryCode: "US" },
  { storeId: "411", city: "College Park", region: "MD", countryCode: "US" },
  { storeId: "413", city: "Covina", region: "CA", countryCode: "US" },
  { storeId: "462", city: "Las Vegas", region: "NV", countryCode: "US" },
  { storeId: "488", city: "Renton", region: "WA", countryCode: "US" },
  { storeId: "508", city: "Memphis", region: "TN", countryCode: "US" },
  { storeId: "511", city: "Columbus", region: "OH", countryCode: "US" },
  { storeId: "535", city: "Grand Prairie", region: "TX", countryCode: "US" },
  { storeId: "536", city: "Fishers", region: "IN", countryCode: "US" },
  { storeId: "537", city: "Jacksonville", region: "FL", countryCode: "US" },
  { storeId: "560", city: "Oak Creek", region: "WI", countryCode: "US" },
  { storeId: "569", city: "Norfolk", region: "VA", countryCode: "US" },
  { storeId: "570", city: "Live Oak", region: "TX", countryCode: "US" },
  { storeId: "921", city: "Brooklyn", region: "NY", countryCode: "US" },
  { storeId: "1099", city: "University Park", region: "TX", countryCode: "US" },
  { storeId: "1129", city: "Syracuse", region: "NY", countryCode: "US" },
  // ── Canada ───────────────────────────────────────────────────────────────────
  // All probed against stock API with item 20522046 — all return 200.
  { storeId: "003", city: "Richmond", region: "BC", countryCode: "CA" },
  { storeId: "004", city: "Ottawa", region: "ON", countryCode: "CA" },
  { storeId: "039", city: "Montreal", region: "QC", countryCode: "CA" },
  { storeId: "040", city: "Burlington", region: "ON", countryCode: "CA" },
  { storeId: "149", city: "North York", region: "ON", countryCode: "CA" },
  { storeId: "216", city: "Calgary", region: "AB", countryCode: "CA" },
  { storeId: "249", city: "Winnipeg", region: "MB", countryCode: "CA" },
  { storeId: "256", city: "Etobicoke", region: "ON", countryCode: "CA" },
  { storeId: "313", city: "Coquitlam", region: "BC", countryCode: "CA" },
  { storeId: "349", city: "Edmonton", region: "AB", countryCode: "CA" },
  { storeId: "372", city: "Vaughan", region: "ON", countryCode: "CA" },
  { storeId: "414", city: "Boucherville", region: "QC", countryCode: "CA" },
  { storeId: "529", city: "Halifax", region: "NS", countryCode: "CA" },
  { storeId: "559", city: "Quebec City", region: "QC", countryCode: "CA" },
  { storeId: "659", city: "Toronto Downtown", region: "ON", countryCode: "CA" },
  // ── Norway ───────────────────────────────────────────────────────────────────
  // Full-size stores only. All probed against stock API with item 00263850 — all return 200
  // with a cash-and-carry quantity. City is the metropolitan area the store is known by.
  { storeId: "007", name: "Sørlandet", city: "Kristiansand", countryCode: "NO" },
  { storeId: "091", name: "Slependen", city: "Asker", countryCode: "NO" },
  { storeId: "095", name: "Furuset", city: "Oslo", countryCode: "NO" },
  { storeId: "126", name: "Forus", city: "Stavanger", countryCode: "NO" },
  { storeId: "371", name: "Leangen", city: "Trondheim", countryCode: "NO" },
  { storeId: "390", name: "Ringsaker", city: "Hamar", countryCode: "NO" },
  { storeId: "441", name: "Åsane", city: "Bergen", countryCode: "NO" },
];

/**
 * Display label: "<id> (<name>, <city>, <region>, <country>)" with absent parts omitted.
 * US labels historically carry no country suffix; that quirk is preserved so existing
 * labels stay byte-identical ("026 (Canton, MI)", "003 (Richmond, BC, CA)", "095 (Furuset, Oslo, NO)").
 */
export function storeLabelFor(store: StoreRecord): string {
  const parts = [
    store.name,
    store.city,
    store.region,
    store.countryCode === "US" ? undefined : store.countryCode,
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  return `${store.storeId} (${parts.join(", ")})`;
}

const BY_ID: ReadonlyMap<string, StoreRecord> = new Map(STORES.map((s) => [s.storeId, s]));

/** storeId → label. Kept for backward compatibility; prefer storeLabel() / STORES. */
export const STORE_LABELS: Record<string, string> = Object.fromEntries(
  STORES.map((s) => [s.storeId, storeLabelFor(s)])
);

export function storeLabel(storeId: string): string | undefined {
  const store = BY_ID.get(storeId);
  return store ? storeLabelFor(store) : undefined;
}

export function storeCountry(storeId: string): CountryCode | undefined {
  return BY_ID.get(storeId)?.countryCode;
}

/** All catalog store IDs in declaration order (US, CA, NO). */
export function allStoreIds(): string[] {
  return STORES.map((s) => s.storeId);
}

export function storeIdsByCountry(countryCode: CountryCode): string[] {
  return STORES.filter((s) => s.countryCode === countryCode).map((s) => s.storeId);
}
