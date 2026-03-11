import { fetchJson } from "../utils/http.js";

const SEARCH_BASE = "https://sik.search.blue.cdtapps.com";
const STOCK_BASE = "https://api.ingka.ikea.com/cia/availabilities";

// Confirmed public client ID (no secret required)
const STOCK_CLIENT_ID = "b6c117e5-ae61-4ef5-b4cc-e0b1e37f0631";

// ── Search types (confirmed from live API 2026-03-11) ────────────────────────

interface SearchSalesPrice {
  currencyCode: string;
  numeral: number;
  // TODO: full `current` display object not typed — not needed for MVP
}

interface SearchProduct {
  id: string;
  itemNo: string;
  itemNoGlobal: string;
  name: string;
  typeName: string;
  itemMeasureReferenceText: string;
  mainImageUrl: string;
  pipUrl: string;
  onlineSellable: boolean;
  lastChance: boolean;
  ratingValue: number | null;
  ratingCount: number | null;
  salesPrice: SearchSalesPrice;
  validDesignText: string;
  // TODO: gprDescription (variants), colors, badge, categoryPath not typed
}

interface SearchResultItem {
  type: string; // "PRODUCT" observed; other types possible
  product: SearchProduct;
  // TODO: actionTokens, isBreakout not typed
}

interface SearchResultMain {
  items: SearchResultItem[];
  start: number;
  end: number;
  max: number;
  moreToken: string | null;
}

interface SearchResultPage {
  searchPhrase: string;
  products: {
    main: SearchResultMain;
    // TODO: filters, sortOrders, shelves not typed
  };
  // TODO: didYouMean, relatedSearches, retiredProducts not typed
}

export interface SearchResponse {
  searchResultPage: SearchResultPage;
  // TODO: usergroup, testActivationTriggers not typed
}

// ── Stock types (confirmed from live API 2026-03-11) ─────────────────────────

interface StockProbabilityLevel {
  messageType: string; // e.g. "HIGH_IN_STOCK"
  // TODO: colour (rgbDec, rgbHex, token) not typed — not needed for MVP
}

interface StockAvailability {
  quantity: number;
  updateDateTime: string;
  probability: {
    thisDay: StockProbabilityLevel;
    // TODO: other probability levels (inStore etc.) not confirmed
  };
}

interface StockCashCarry {
  availability: StockAvailability;
  availableForCashCarry?: boolean; // observed at top-level availability; repeated here
  eligibleForStockNotification: boolean;
  unitOfMeasure: string;
  updateDateTime: string;
  // TODO: range, tags not typed
}

interface StockAvailabilityItem {
  availableForCashCarry: boolean;
  availableForClickCollect: boolean;
  buyingOption: {
    cashCarry: StockCashCarry;
    // TODO: clickCollect, homeDelivery range objects not typed
  };
  classUnitKey: {
    classUnitCode: string;
    classUnitType: string; // "STO" observed
  };
  itemKey: {
    itemNo: string;
    itemType: string; // "ART" observed
  };
}

interface StockError {
  // Confirmed: 404 = item not stocked at this store | 405 = store ID does not exist
  code: number;
  message: string;
  // TODO: details not typed
}

export interface StockResponse {
  availabilities: StockAvailabilityItem[] | null;
  errors?: StockError[];
  timestamp: string;
  // TODO: traceId not typed — not needed for MVP
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function annotateStockErrors(errors: StockResponse["errors"]) {
  return errors?.map((e) => ({
    ...e,
    meaning: e.code === 404 ? "item not stocked at this store" : e.code === 405 ? "store ID does not exist" : "unknown",
  }));
}

export function projectStock(result: StockResponse) {
  const a = result.availabilities?.[0];
  return {
    availableForCashCarry: a?.availableForCashCarry ?? false,
    quantity: a?.buyingOption.cashCarry.availability.quantity ?? null,
    messageType: a?.buyingOption.cashCarry.availability.probability.thisDay.messageType ?? null,
    errors: annotateStockErrors(result.errors) ?? null,
  };
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function searchProducts(
  query: string,
  countryCode: string,
  langCode: string,
  size: number
): Promise<SearchResponse> {
  // Correct endpoint: /search-result-page (not /search — returns 404)
  const url =
    `${SEARCH_BASE}/${countryCode}/${langCode}/search-result-page` +
    `?q=${encodeURIComponent(query)}&size=${size}`;
  return fetchJson<SearchResponse>(url, {
    "User-Agent": "Mozilla/5.0",
  });
}

export async function getStoreStock(
  itemNo: string,
  storeId: string,
  // countryCode unused: endpoint path is /sto/{storeId}, country is implicit in storeId
  _countryCode: string
): Promise<StockResponse> {
  // classUnitType must be "sto" (not country code); "ru" exists but storeId maps to "sto"
  const url =
    `${STOCK_BASE}/sto/${storeId}` +
    `?itemNos=${encodeURIComponent(itemNo)}&expand=StoresList,Restocks`;
  return fetchJson<StockResponse>(url, {
    "X-Client-Id": STOCK_CLIENT_ID,
  });
}
