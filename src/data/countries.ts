// Supported countries for the stock tools and the store catalog.
// Adding a country: add it here, add its stores to ./stores.ts, add README rows.

export const COUNTRY_CODES = ["US", "CA", "NO"] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

/** Default language for the IKEA search API when the client does not pass langCode. */
export const DEFAULT_LANG_CODE: Record<CountryCode, string> = {
  US: "en",
  CA: "en",
  NO: "no",
};

export function isCountryCode(value: string): value is CountryCode {
  return (COUNTRY_CODES as readonly string[]).includes(value);
}

/** Default search language for a country; "en" for countries outside the catalog. */
export function defaultLangCode(countryCode: string): string {
  return isCountryCode(countryCode) ? DEFAULT_LANG_CODE[countryCode] : "en";
}
