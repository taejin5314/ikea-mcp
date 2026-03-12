// US store labels confirmed from ikea.com/us/en/stores/<slug>/ pages (store_id= survey param).
// IDs match the sto/{storeId} path used by the IKEA stock API.
// 4-digit IDs (921, 1099, 1129) are newer-format stores — confirmed working with stock API.
// 3136 (San Francisco) returns 405 from stock API — excluded.
// TODO: huntsville, arcadia, mcallen-pharr, san-marcos — IDs not found on store pages.
// TODO: 313, 372, 414, 448, 529, 559, 612, 634, 652, 661, 663, 692, 693 — valid API IDs, city unknown (possibly CA/other).
export const STORE_LABELS: Record<string, string> = {
  "026": "026 (Canton, MI)",
  "027": "027 (Round Rock, TX)",
  "028": "028 (Portland, OR)",
  "042": "042 (Tampa, FL)",
  "064": "064 (Centennial, CO)",
  "067": "067 (Charlotte, NC)",
  "103": "103 (Draper, UT)",
  "145": "145 (Orlando, FL)",
  "152": "152 (Baltimore, MD)",
  "153": "153 (Pittsburgh, PA)",
  "154": "154 (Elizabeth, NJ)",
  "156": "156 (Long Island, NY)",
  "157": "157 (West Sacramento, CA)",
  "158": "158 (Stoughton, MA)",
  "162": "162 (Carson, CA)",
  "165": "165 (Emeryville, CA)",
  "166": "166 (San Diego, CA)",
  "167": "167 (Costa Mesa, CA)",
  "168": "168 (Woodbridge, VA)",
  "170": "170 (Bolingbrook, IL)",
  "175": "175 (West Chester, OH)",
  "183": "183 (Frisco, TX)",
  "207": "207 (Sunrise, FL)",
  "209": "209 (Tempe, AZ)",
  "210": "210 (Schaumburg, IL)",
  "211": "211 (Conshohocken, PA)",
  "212": "212 (Minneapolis, MN)",
  "213": "213 (New Haven, CT)",
  "215": "215 (South Philadelphia, PA)",
  "257": "257 (Atlanta, GA)",
  "327": "327 (Miami, FL)",
  "347": "347 (East Palo Alto, CA)",
  "374": "374 (Merriam, KS)",
  "379": "379 (Houston, TX)",
  "399": "399 (Burbank, CA)",
  "409": "409 (Paramus, NJ)",
  "410": "410 (St. Louis, MO)",
  "411": "411 (College Park, MD)",
  "413": "413 (Covina, CA)",
  "462": "462 (Las Vegas, NV)",
  "488": "488 (Renton, WA)",
  "508": "508 (Memphis, TN)",
  "511": "511 (Columbus, OH)",
  "535": "535 (Grand Prairie, TX)",
  "536": "536 (Fishers, IN)",
  "537": "537 (Jacksonville, FL)",
  "560": "560 (Oak Creek, WI)",
  "569": "569 (Norfolk, VA)",
  "570": "570 (Live Oak, TX)",
  "921": "921 (Brooklyn, NY)",
  "1099": "1099 (University Park, TX)",
  "1129": "1129 (Syracuse, NY)",
};

export function storeLabel(storeId: string): string | undefined {
  return STORE_LABELS[storeId];
}
