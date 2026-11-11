import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { projectStock, projectProduct, projectMultiItemStock, type StockResponse } from "../src/services/ikea.js";
import { storeIdsByCountry, STORE_LABELS, STORES, storeLabel, storeLabelFor, storeCountry, allStoreIds } from "../src/data/stores.js";
import { readFileSync } from "node:fs";
import { COUNTRY_CODES, DEFAULT_LANG_CODE, defaultLangCode, isCountryCode } from "../src/data/countries.js";
import { listStoresTool } from "../src/tools/list_stores.js";
import { compareStoreStockTool } from "../src/tools/compare_store_stock.js";
import { findBestStoreForItemTool } from "../src/tools/find_best_store_for_item.js";
import { findBestStoreForCartTool } from "../src/tools/find_best_store_for_cart.js";
import { searchProductsTool } from "../src/tools/search_products.js";
import { getProductDetailsTool } from "../src/tools/get_product_details.js";
import { checkCartAvailabilityTool } from "../src/tools/check_cart_availability.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeStockResponse(overrides: Partial<StockResponse> = {}): StockResponse {
  return {
    availabilities: [
      {
        availableForCashCarry: true,
        availableForClickCollect: false,
        buyingOption: {
          cashCarry: {
            availability: {
              quantity: 42,
              updateDateTime: "2026-03-11T00:00:00Z",
              probability: { thisDay: { messageType: "HIGH_IN_STOCK" } },
            },
            eligibleForStockNotification: false,
            unitOfMeasure: "PIECES",
            updateDateTime: "2026-03-11T00:00:00Z",
          },
        },
        classUnitKey: { classUnitCode: "399", classUnitType: "STO" },
        itemKey: { itemNo: "20522046", itemType: "ART" },
      },
    ],
    timestamp: "2026-03-11T00:00:00Z",
    ...overrides,
  };
}

// ── projectStock ──────────────────────────────────────────────────────────────

test("projectStock — stocked item returns correct shape", () => {
  const result = projectStock(makeStockResponse());
  assert.deepEqual(result, {
    availableForCashCarry: true,
    inRange: null,
    quantity: 42,
    messageType: "HIGH_IN_STOCK",
    eligibleForStockNotification: false,
    errors: [],
  });
});

test("projectStock — empty availabilities returns null fields", () => {
  const result = projectStock(makeStockResponse({ availabilities: [] }));
  assert.equal(result.availableForCashCarry, false);
  assert.equal(result.quantity, null);
  assert.equal(result.messageType, null);
  assert.equal(result.eligibleForStockNotification, null);
  assert.deepEqual(result.errors, []);
});

test("projectStock — null availabilities (405 store-not-found) returns null fields", () => {
  const result = projectStock(makeStockResponse({
    availabilities: null,
    errors: [{ code: 405, message: "ClassUnitCode doesn't exist" }],
  }));
  assert.equal(result.availableForCashCarry, false);
  assert.equal(result.quantity, null);
  assert.equal(result.messageType, null);
  assert.equal(result.errors![0].meaning, "store ID does not exist");
});

// ── annotateStockErrors (via projectStock.errors) ────────────────────────────

test("projectStock — 404 error annotated as 'item not stocked at this store'", () => {
  const result = projectStock(
    makeStockResponse({
      availabilities: [],
      errors: [{ code: 404, message: "Not found" }],
    })
  );
  assert.ok(Array.isArray(result.errors));
  assert.equal(result.errors![0].code, 404);
  assert.equal(result.errors![0].meaning, "item not stocked at this store");
});

test("projectStock — 405 error annotated as 'store ID does not exist'", () => {
  const result = projectStock(
    makeStockResponse({
      availabilities: [],
      errors: [{ code: 405, message: "Method Not Allowed" }],
    })
  );
  assert.equal(result.errors![0].meaning, "store ID does not exist");
});

test("projectStock — unknown error code annotated as 'unknown'", () => {
  const result = projectStock(
    makeStockResponse({
      availabilities: [],
      errors: [{ code: 500, message: "Internal Server Error" }],
    })
  );
  assert.equal(result.errors![0].meaning, "unknown");
});

// ── find_best_store_for_item ranking logic ────────────────────────────────────

function rankStores(
  entries: { storeId: string; availableForCashCarry: boolean; quantity: number | null }[],
  maxResults: number
) {
  return entries
    .filter((r) => r.availableForCashCarry && r.quantity !== null)
    .sort((a, b) => {
      const diff = (b.quantity ?? 0) - (a.quantity ?? 0);
      return diff !== 0 ? diff : a.storeId.localeCompare(b.storeId);
    })
    .slice(0, maxResults);
}

test("findBestStore — excludes unavailable and null-qty stores", () => {
  const input = [
    { storeId: "399", availableForCashCarry: true, quantity: 50 },
    { storeId: "026", availableForCashCarry: false, quantity: 100 }, // not available
    { storeId: "921", availableForCashCarry: true, quantity: null }, // null qty
  ];
  const result = rankStores(input, 3);
  assert.equal(result.length, 1);
  assert.equal(result[0].storeId, "399");
});

test("findBestStore — sorts descending by quantity", () => {
  const input = [
    { storeId: "399", availableForCashCarry: true, quantity: 20 },
    { storeId: "026", availableForCashCarry: true, quantity: 80 },
    { storeId: "921", availableForCashCarry: true, quantity: 50 },
  ];
  const result = rankStores(input, 3);
  assert.deepEqual(result.map((r) => r.storeId), ["026", "921", "399"]);
});

test("findBestStore — tie-breaks by storeId lexicographic", () => {
  const input = [
    { storeId: "399", availableForCashCarry: true, quantity: 42 },
    { storeId: "026", availableForCashCarry: true, quantity: 42 },
    { storeId: "921", availableForCashCarry: true, quantity: 42 },
  ];
  const result = rankStores(input, 3);
  assert.deepEqual(result.map((r) => r.storeId), ["026", "399", "921"]);
});

test("findBestStore — respects maxResults", () => {
  const input = [
    { storeId: "399", availableForCashCarry: true, quantity: 10 },
    { storeId: "026", availableForCashCarry: true, quantity: 20 },
    { storeId: "921", availableForCashCarry: true, quantity: 30 },
    { storeId: "042", availableForCashCarry: true, quantity: 40 },
  ];
  const result = rankStores(input, 2);
  assert.equal(result.length, 2);
  assert.equal(result[0].storeId, "042");
  assert.equal(result[1].storeId, "921");
});

test("findBestStore — returns empty array when no store has stock", () => {
  const input = [
    { storeId: "999", availableForCashCarry: false, quantity: null },
  ];
  const result = rankStores(input, 3);
  assert.deepEqual(result, []);
});

// ── projectProduct ────────────────────────────────────────────────────────────

test("projectProduct — projects expected fields and excludes raw fields", () => {
  const raw = {
    id: "abc",
    itemNo: "20522046",
    itemNoGlobal: "20522046",
    name: "BILLY",
    typeName: "Bookcase",
    itemMeasureReferenceText: '31 1/2x11x79 1/2"',
    mainImageUrl: "https://example.com/img.jpg",
    pipUrl: "https://www.ikea.com/us/en/p/billy-bookcase-white-20522046/",
    onlineSellable: true,
    lastChance: false,
    ratingValue: 4.6,
    ratingCount: 2620,
    salesPrice: { currencyCode: "USD", numeral: 79 },
    validDesignText: "white",
  } as Parameters<typeof projectProduct>[0];

  const out = projectProduct(raw);

  assert.deepEqual(out, {
    itemNo: "20522046",
    name: "BILLY",
    typeName: "Bookcase",
    salesPrice: { amount: 79, currencyCode: "USD" },
    pipUrl: "https://www.ikea.com/us/en/p/billy-bookcase-white-20522046/",
    designText: "white",
    measureText: '31 1/2x11x79 1/2"',
    ratingValue: 4.6,
    ratingCount: 2620,
    imageUrl: "https://example.com/img.jpg",
  });

  assert.equal("id" in out, false);
  assert.equal("imageUrl" in out, true);
  assert.equal("onlineSellable" in out, false);
});

// ── search_products output projection ────────────────────────────────────────
// Tests the projection formula used in the tool handler against a fixture.

test("search_products projection — selects expected fields only", () => {
  // Minimal fake SearchResponse
  const raw = {
    searchResultPage: {
      searchPhrase: "billy",
      products: {
        main: {
          items: [
            {
              type: "PRODUCT",
              product: {
                id: "abc",
                itemNo: "20522046",
                itemNoGlobal: "20522046",
                name: "BILLY",
                typeName: "Bookcase",
                itemMeasureReferenceText: '31 1/2x11x79 1/2"',
                mainImageUrl: "https://example.com/img.jpg",
                pipUrl: "https://www.ikea.com/us/en/p/billy/",
                onlineSellable: true,
                lastChance: false,
                ratingValue: 4.8,
                ratingCount: 1000,
                salesPrice: { currencyCode: "USD", numeral: 69.99 },
                validDesignText: "white",
              },
            },
          ],
          start: 0,
          end: 1,
          max: 97,
          moreToken: null,
        },
      },
    },
  };

  // Mirrors the projection in src/tools/search_products.ts
  const main = raw.searchResultPage.products.main;
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

  assert.equal(output.total, 97);
  assert.equal(output.items.length, 1);

  const item = output.items[0];
  assert.deepEqual(Object.keys(item).sort(), [
    "imageUrl", "itemNo", "name", "pipUrl", "ratingCount", "ratingValue", "salesPrice", "typeName",
  ].sort());
  assert.equal(item.itemNo, "20522046");
  assert.equal(item.name, "BILLY");
  assert.deepEqual(item.salesPrice, { amount: 69.99, currencyCode: "USD" });
  assert.equal(item.imageUrl, "https://example.com/img.jpg");

  // Fields that must NOT be present
  assert.equal("id" in item, false);
  assert.equal("mainImageUrl" in item, false);
  assert.equal("onlineSellable" in item, false);
});

// ── projectMultiItemStock ─────────────────────────────────────────────────────

function makeAvailability(itemNo: string, quantity: number) {
  return {
    availableForCashCarry: true,
    availableForClickCollect: false,
    buyingOption: {
      cashCarry: {
        availability: {
          quantity,
          updateDateTime: "2026-03-12T00:00:00Z",
          probability: { thisDay: { messageType: "HIGH_IN_STOCK" } },
        },
        eligibleForStockNotification: false,
        unitOfMeasure: "PIECES",
        updateDateTime: "2026-03-12T00:00:00Z",
      },
    },
    classUnitKey: { classUnitCode: "399", classUnitType: "STO" },
    itemKey: { itemNo, itemType: "ART" },
  };
}

test("projectMultiItemStock — multiple valid items returns correct shape", () => {
  const result = projectMultiItemStock(
    { availabilities: [makeAvailability("20522046", 10), makeAvailability("40477340", 5)], timestamp: "t" },
    ["20522046", "40477340"]
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].itemNo, "20522046");
  assert.equal(result[0].quantity, 10);
  assert.deepEqual(result[0].errors, []);
  assert.equal(result[1].itemNo, "40477340");
  assert.equal(result[1].quantity, 5);
});

test("projectMultiItemStock — preserves input order", () => {
  const result = projectMultiItemStock(
    { availabilities: [makeAvailability("40477340", 5), makeAvailability("20522046", 10)], timestamp: "t" },
    ["20522046", "40477340"]
  );
  assert.equal(result[0].itemNo, "20522046");
  assert.equal(result[1].itemNo, "40477340");
});

test("projectMultiItemStock — one stocked one not stocked", () => {
  const result = projectMultiItemStock(
    {
      availabilities: [makeAvailability("20522046", 10)],
      errors: [{ code: 404, message: "Not found", details: { itemNo: "99999999" } }],
      timestamp: "t",
    },
    ["20522046", "99999999"]
  );
  assert.equal(result[0].availableForCashCarry, true);
  assert.deepEqual(result[0].errors, []);
  assert.equal(result[1].availableForCashCarry, false);
  assert.equal(result[1].quantity, null);
  assert.equal(result[1].errors.length, 1);
  assert.equal(result[1].errors[0].code, 404);
});

test("projectMultiItemStock — invalid store (405) all items get store error", () => {
  const result = projectMultiItemStock(
    {
      availabilities: null,
      errors: [{ code: 405, message: "Store not found" }],
      timestamp: "t",
    },
    ["20522046", "40477340"]
  );
  assert.equal(result.length, 2);
  result.forEach((r) => {
    assert.equal(r.availableForCashCarry, false);
    assert.equal(r.errors[0].code, 405);
    assert.equal(r.errors[0].meaning, "store ID does not exist");
  });
});

// ── compareStoreStock input resolution ───────────────────────────────────────

import { CompareStoreStockInput, CheckCartAvailabilityInput, FindBestStoreForCartInput, ListStoresInput, CheckMultiItemStockInput, FindBestStoreInput, SearchProductsInput, GetProductDetailsInput } from "../src/schemas/index.js";

test("compareStoreStock — storeIds provided, no countryCode: uses storeIds", () => {
  const input = CompareStoreStockInput.parse({ itemNo: "20522046", storeIds: ["399", "026"] });
  assert.deepEqual(input.storeIds, ["399", "026"]);
  assert.equal(input.countryCode, undefined);
});

test("compareStoreStock — countryCode US, no storeIds: parses and storeIds undefined", () => {
  const input = CompareStoreStockInput.parse({ itemNo: "20522046", countryCode: "US" });
  assert.equal(input.storeIds, undefined);
  assert.equal(input.countryCode, "US");
  const ids = storeIdsByCountry("US");
  assert.ok(ids.length > 0);
  assert.ok(ids.includes("399"));
});

test("compareStoreStock — countryCode CA, no storeIds: parses and storeIds undefined", () => {
  const input = CompareStoreStockInput.parse({ itemNo: "20522046", countryCode: "CA" });
  assert.equal(input.storeIds, undefined);
  assert.equal(input.countryCode, "CA");
  const ids = storeIdsByCountry("CA");
  assert.ok(ids.length > 0);
  assert.ok(ids.includes("149"));
});

test("compareStoreStock — neither storeIds nor countryCode: throws", () => {
  assert.throws(
    () => CompareStoreStockInput.parse({ itemNo: "20522046" }),
    /provide storeIds or countryCode/
  );
});

test("compareStoreStock — storeIds takes precedence over countryCode", () => {
  const input = CompareStoreStockInput.parse({ itemNo: "20522046", storeIds: ["399", "026"], countryCode: "CA" });
  assert.deepEqual(input.storeIds, ["399", "026"]);
  assert.equal(input.countryCode, "CA");
  // handler uses storeIds when present; CA countryCode is still captured for API locale
});

// ── storeIdsByCountry ─────────────────────────────────────────────────────────

test("storeIdsByCountry — CA returns only CA stores", () => {
  const ids = storeIdsByCountry("CA");
  assert.equal(ids.length, 15);
  ids.forEach((id) => assert.equal(storeCountry(id), "CA"));
});

test("storeIdsByCountry — US returns only US stores", () => {
  const ids = storeIdsByCountry("US");
  assert.equal(ids.length, 52);
  ids.forEach((id) => assert.equal(storeCountry(id), "US"));
});

test("storeIdsByCountry — NO returns exactly the seven Norwegian stores", () => {
  assert.deepEqual(storeIdsByCountry("NO"), ["007", "091", "095", "126", "371", "390", "441"]);
});

test("storeIdsByCountry — US, CA and NO partition all stores exactly", () => {
  const us = storeIdsByCountry("US");
  const ca = storeIdsByCountry("CA");
  const no = storeIdsByCountry("NO");
  const all = allStoreIds();
  assert.equal(us.length + ca.length + no.length, all.length);
  assert.equal(new Set([...us, ...ca, ...no]).size, all.length);
  assert.equal(all.length, 74);
  assert.equal(Object.keys(STORE_LABELS).length, 74);
});

test("storeIdsByCountry — known CA store 149 is in CA set", () => {
  const ca = storeIdsByCountry("CA");
  assert.ok(ca.includes("149"));
});

test("storeIdsByCountry — known US store 399 is in US set", () => {
  const us = storeIdsByCountry("US");
  assert.ok(us.includes("399"));
});

test("projectMultiItemStock — errors always array, never null", () => {
  const result = projectMultiItemStock(
    { availabilities: [makeAvailability("20522046", 1)], timestamp: "t" },
    ["20522046"]
  );
  assert.ok(Array.isArray(result[0].errors));
});

// ── CheckCartAvailabilityInput schema ────────────────────────────────────────

test("checkCartAvailability schema — valid input parses and normalizes itemNo", () => {
  const input = CheckCartAvailabilityInput.parse({
    storeId: "399",
    items: [{ itemNo: "005.221.32", quantity: 2 }],
  });
  assert.equal(input.storeId, "399");
  assert.equal(input.items[0].itemNo, "00522132");
  assert.equal(input.items[0].quantity, 2);
});

test("checkCartAvailability schema — quantity defaults to 1", () => {
  const input = CheckCartAvailabilityInput.parse({
    storeId: "399",
    items: [{ itemNo: "20522046" }],
  });
  assert.equal(input.items[0].quantity, 1);
});

test("checkCartAvailability schema — rejects empty items array", () => {
  assert.throws(() => CheckCartAvailabilityInput.parse({ storeId: "399", items: [] }));
});

// ── check_cart_availability projection logic ──────────────────────────────────

function projectCart(
  availabilities: NonNullable<Parameters<typeof projectMultiItemStock>[0]["availabilities"]>,
  errors: { code: number; message: string; details?: { itemNo?: string } }[] | undefined,
  items: { itemNo: string; quantity: number }[]
) {
  const byItemNo = new Map(availabilities.map((a) => [a.itemKey.itemNo, a]));
  const storeError = (errors ?? []).find((e) => e.code === 405);
  return items.map((item) => {
    if (storeError) return { itemNo: item.itemNo, inStock: null, sufficient: false };
    const a = byItemNo.get(item.itemNo);
    if (a) {
      const inStock = a.buyingOption.cashCarry.availability!.quantity; // makeAvailability always sets it
      return { itemNo: item.itemNo, inStock, sufficient: inStock >= item.quantity };
    }
    return { itemNo: item.itemNo, inStock: null, sufficient: false };
  });
}

test("checkCartAvailability — allSufficient true when all items have enough stock", () => {
  const avail = [makeAvailability("20522046", 10), makeAvailability("40477340", 5)];
  const rows = projectCart(avail, undefined, [
    { itemNo: "20522046", quantity: 3 },
    { itemNo: "40477340", quantity: 5 },
  ]);
  assert.ok(rows.every((r) => r.sufficient));
});

test("checkCartAvailability — allSufficient false when one item is short", () => {
  const avail = [makeAvailability("20522046", 2)];
  const rows = projectCart(avail, undefined, [{ itemNo: "20522046", quantity: 3 }]);
  assert.equal(rows[0].sufficient, false);
});

test("checkCartAvailability — 405 store error marks all items insufficient", () => {
  const rows = projectCart([], [{ code: 405, message: "Store not found" }], [
    { itemNo: "20522046", quantity: 1 },
    { itemNo: "40477340", quantity: 1 },
  ]);
  assert.ok(rows.every((r) => !r.sufficient && r.inStock === null));
});

// ── find_best_store_for_cart scoring logic ────────────────────────────────────

interface CartStoreEntry {
  storeId: string;
  items: { itemNo: string; quantity: number; inStock: number | null; sufficient: boolean }[];
}

function scoreCartStores(entries: CartStoreEntry[], maxResults: number) {
  return entries
    .map((e) => {
      const fulfilledCount = e.items.filter((i) => i.sufficient).length;
      const totalStock = e.items.reduce((sum, i) => sum + (i.inStock ?? 0), 0);
      return { ...e, fulfilledCount, totalStock, totalCount: e.items.length, allSufficient: fulfilledCount === e.items.length };
    })
    .sort((a, b) => {
      const fc = b.fulfilledCount - a.fulfilledCount;
      if (fc !== 0) return fc;
      const ts = b.totalStock - a.totalStock;
      if (ts !== 0) return ts;
      return a.storeId.localeCompare(b.storeId);
    })
    .slice(0, maxResults);
}

test("findBestStoreForCart — ranks by fulfilledCount first", () => {
  const entries: CartStoreEntry[] = [
    { storeId: "399", items: [{ itemNo: "A", quantity: 1, inStock: 50, sufficient: true }, { itemNo: "B", quantity: 1, inStock: null, sufficient: false }] },
    { storeId: "026", items: [{ itemNo: "A", quantity: 1, inStock: 10, sufficient: true }, { itemNo: "B", quantity: 1, inStock: 5, sufficient: true }] },
  ];
  const result = scoreCartStores(entries, 3);
  assert.equal(result[0].storeId, "026"); // 2/2 fulfilled
  assert.equal(result[1].storeId, "399"); // 1/2 fulfilled
});

test("findBestStoreForCart — tie-breaks by totalStock", () => {
  const entries: CartStoreEntry[] = [
    { storeId: "399", items: [{ itemNo: "A", quantity: 1, inStock: 10, sufficient: true }] },
    { storeId: "026", items: [{ itemNo: "A", quantity: 1, inStock: 50, sufficient: true }] },
  ];
  const result = scoreCartStores(entries, 3);
  assert.equal(result[0].storeId, "026"); // higher total stock
});

test("findBestStoreForCart — tie-breaks by storeId when fulfilledCount and totalStock equal", () => {
  const entries: CartStoreEntry[] = [
    { storeId: "399", items: [{ itemNo: "A", quantity: 1, inStock: 10, sufficient: true }] },
    { storeId: "026", items: [{ itemNo: "A", quantity: 1, inStock: 10, sufficient: true }] },
  ];
  const result = scoreCartStores(entries, 3);
  assert.equal(result[0].storeId, "026");
  assert.equal(result[1].storeId, "399");
});

test("findBestStoreForCart — respects maxResults", () => {
  const entries: CartStoreEntry[] = [
    { storeId: "399", items: [{ itemNo: "A", quantity: 1, inStock: 30, sufficient: true }] },
    { storeId: "026", items: [{ itemNo: "A", quantity: 1, inStock: 20, sufficient: true }] },
    { storeId: "921", items: [{ itemNo: "A", quantity: 1, inStock: 10, sufficient: true }] },
  ];
  const result = scoreCartStores(entries, 2);
  assert.equal(result.length, 2);
});

test("findBestStoreForCart — allSufficient flag correct", () => {
  const entries: CartStoreEntry[] = [
    { storeId: "399", items: [{ itemNo: "A", quantity: 2, inStock: 10, sufficient: true }, { itemNo: "B", quantity: 3, inStock: 5, sufficient: true }] },
    { storeId: "026", items: [{ itemNo: "A", quantity: 2, inStock: 10, sufficient: true }, { itemNo: "B", quantity: 3, inStock: 1, sufficient: false }] },
  ];
  const result = scoreCartStores(entries, 3);
  assert.equal(result[0].allSufficient, true);  // 399: 2/2
  assert.equal(result[1].allSufficient, false); // 026: 1/2
});

// ── FindBestStoreForCartInput schema ──────────────────────────────────────────

test("findBestStoreForCart schema — valid input parses and normalizes itemNo", () => {
  const input = FindBestStoreForCartInput.parse({
    items: [{ itemNo: "005.221.32", quantity: 2 }],
    countryCode: "ca",
  });
  assert.equal(input.items[0].itemNo, "00522132");
  assert.equal(input.items[0].quantity, 2);
  assert.equal(input.countryCode, "CA");
  assert.equal(input.maxResults, 3);
});

test("findBestStoreForCart schema — quantity defaults to 1", () => {
  const input = FindBestStoreForCartInput.parse({ items: [{ itemNo: "20522046" }] });
  assert.equal(input.items[0].quantity, 1);
});

test("findBestStoreForCart schema — rejects empty items array", () => {
  assert.throws(() => FindBestStoreForCartInput.parse({ items: [] }));
});

// ── ListStoresInput schema ────────────────────────────────────────────────────

test("listStores schema — parses without countryCode", () => {
  const input = ListStoresInput.parse({});
  assert.equal(input.countryCode, undefined);
});

test("listStores schema — parses with countryCode and normalizes", () => {
  const input = ListStoresInput.parse({ countryCode: "ca" });
  assert.equal(input.countryCode, "CA");
});

// ── CheckMultiItemStockInput schema ──────────────────────────────────────────

test("checkMultiItemStock schema — normalizes itemNos", () => {
  const input = CheckMultiItemStockInput.parse({ storeId: "399", itemNos: ["005.221.32", "20522046"] });
  assert.equal(input.itemNos[0], "00522132");
  assert.equal(input.itemNos[1], "20522046");
});

test("checkMultiItemStock schema — rejects empty itemNos array", () => {
  assert.throws(() => CheckMultiItemStockInput.parse({ storeId: "399", itemNos: [] }));
});

// ── FindBestStoreInput schema ────────────────────────────────────────────────

test("findBestStore schema — defaults maxResults to 3", () => {
  const input = FindBestStoreInput.parse({ itemNo: "20522046" });
  assert.equal(input.maxResults, 3);
});

test("findBestStore schema — normalizes itemNo", () => {
  const input = FindBestStoreInput.parse({ itemNo: "005.221.32" });
  assert.equal(input.itemNo, "00522132");
});

// ── projectMultiItemStock includes eligibleForStockNotification ──────────────

test("projectMultiItemStock — stocked item includes eligibleForStockNotification", () => {
  const result = projectMultiItemStock(
    { availabilities: [makeAvailability("20522046", 10)], timestamp: "t" },
    ["20522046"]
  );
  assert.equal(result[0].eligibleForStockNotification, false);
});

test("projectMultiItemStock — not-stocked item has eligibleForStockNotification null", () => {
  const result = projectMultiItemStock(
    { availabilities: [], errors: [{ code: 404, message: "Not found", details: { itemNo: "99999999" } }], timestamp: "t" },
    ["99999999"]
  );
  assert.equal(result[0].eligibleForStockNotification, null);
});

test("projectMultiItemStock — 405 store error has eligibleForStockNotification null", () => {
  const result = projectMultiItemStock(
    { availabilities: null, errors: [{ code: 405, message: "Store not found" }], timestamp: "t" },
    ["20522046"]
  );
  assert.equal(result[0].eligibleForStockNotification, null);
});

// ── Canary — upstream IKEA stock API shape ────────────────────────────────────
// Gate with CANARY=1 to avoid hitting the live API in normal test runs.

if (process.env.CANARY) {
  test("canary — upstream stock API shape is stable", async () => {
    const res = await fetch(
      "https://api.ingka.ikea.com/cia/availabilities/sto/399?itemNos=20522046&expand=StoresList,Restocks",
      { headers: { "X-Client-Id": "b6c117e5-ae61-4ef5-b4cc-e0b1e37f0631", Accept: "application/json" } }
    );
    assert.ok(res.ok, `unexpected HTTP status: ${res.status}`);
    const data = await res.json() as Record<string, unknown>;
    assert.ok("timestamp" in data, "timestamp field missing");
    assert.ok("availabilities" in data, "availabilities field missing");
    if (Array.isArray(data.availabilities) && data.availabilities.length > 0) {
      const a = data.availabilities[0] as Record<string, unknown>;
      assert.ok("itemKey" in a, "itemKey missing");
      assert.ok("availableForCashCarry" in a, "availableForCashCarry missing");
      const cc = a.buyingOption as Record<string, unknown>;
      const avail = (cc?.cashCarry as Record<string, unknown>)?.availability as Record<string, unknown>;
      assert.equal(typeof avail?.quantity, "number", "quantity is not a number");
    }
  });
}

// ── countries ─────────────────────────────────────────────────────────────────

test("countries — COUNTRY_CODES lists US, CA and NO in that order", () => {
  assert.deepEqual([...COUNTRY_CODES], ["US", "CA", "NO"]);
});

test("countries — every country has a default language", () => {
  for (const cc of COUNTRY_CODES) {
    assert.equal(typeof DEFAULT_LANG_CODE[cc], "string");
  }
  assert.equal(DEFAULT_LANG_CODE.NO, "no");
  assert.equal(DEFAULT_LANG_CODE.US, "en");
  assert.equal(DEFAULT_LANG_CODE.CA, "en");
});

test("countries — defaultLangCode falls back to en for unknown countries", () => {
  assert.equal(defaultLangCode("NO"), "no");
  assert.equal(defaultLangCode("US"), "en");
  assert.equal(defaultLangCode("SE"), "en");
  assert.equal(defaultLangCode(""), "en");
});

test("countries — isCountryCode is a type guard over COUNTRY_CODES", () => {
  assert.equal(isCountryCode("NO"), true);
  assert.equal(isCountryCode("no"), false);
  assert.equal(isCountryCode("SE"), false);
});

// ── store catalog labels ──────────────────────────────────────────────────────

test("stores — US and CA labels are byte-identical to the v1.6.2 catalog", () => {
  const expected = JSON.parse(
    readFileSync(new URL("./fixtures/store-labels-v1.6.2.json", import.meta.url), "utf8")
  ) as Record<string, string>;
  const actual: Record<string, string> = {};
  for (const s of STORES) {
    if (s.countryCode !== "NO") actual[s.storeId] = storeLabelFor(s);
  }
  assert.deepEqual(actual, expected);
  assert.equal(Object.keys(expected).length, 67);
});

test("stores — Norwegian labels use name, city and NO", () => {
  assert.equal(storeLabel("095"), "095 (Furuset, Oslo, NO)");
  assert.equal(storeLabel("007"), "007 (Sørlandet, Kristiansand, NO)");
  assert.equal(storeLabel("441"), "441 (Åsane, Bergen, NO)");
  assert.equal(STORE_LABELS["390"], "390 (Ringsaker, Hamar, NO)");
});

test("stores — storeLabel and storeCountry are undefined for unknown IDs", () => {
  assert.equal(storeLabel("999"), undefined);
  assert.equal(storeCountry("999"), undefined);
  assert.equal(storeCountry("095"), "NO");
  assert.equal(storeCountry("399"), "US");
  assert.equal(storeCountry("149"), "CA");
});

test("stores — no duplicate store IDs", () => {
  const ids = allStoreIds();
  assert.equal(new Set(ids).size, ids.length);
});

// ── country enum and langCode defaults ────────────────────────────────────────

test("ListStoresInput — accepts lowercase no and normalises to NO", () => {
  assert.equal(ListStoresInput.parse({ countryCode: "no" }).countryCode, "NO");
  assert.equal(ListStoresInput.parse({ countryCode: "CA" }).countryCode, "CA");
});

test("ListStoresInput — rejects countries outside the catalog", () => {
  assert.throws(() => ListStoresInput.parse({ countryCode: "SE" }));
});

test("CompareStoreStockInput — countryCode NO is accepted", () => {
  const input = CompareStoreStockInput.parse({ itemNo: "00263850", countryCode: "no" });
  assert.equal(input.countryCode, "NO");
  assert.equal(input.storeIds, undefined);
});

test("SearchProductsInput — langCode defaults to the country's language", () => {
  assert.equal(SearchProductsInput.parse({ query: "billy", countryCode: "NO" }).langCode, "no");
  assert.equal(SearchProductsInput.parse({ query: "billy", countryCode: "no" }).langCode, "no");
  assert.equal(SearchProductsInput.parse({ query: "billy", countryCode: "CA" }).langCode, "en");
  assert.equal(SearchProductsInput.parse({ query: "billy" }).langCode, "en");
  assert.equal(SearchProductsInput.parse({ query: "billy", countryCode: "SE" }).langCode, "en");
});

test("SearchProductsInput — explicit langCode wins over the country default", () => {
  const input = SearchProductsInput.parse({ query: "billy", countryCode: "NO", langCode: "en" });
  assert.equal(input.langCode, "en");
  assert.equal(input.countryCode, "NO");
  assert.equal(input.size, 10);
});

test("GetProductDetailsInput — langCode defaults to the country's language", () => {
  assert.equal(GetProductDetailsInput.parse({ itemNo: "00263850", countryCode: "NO" }).langCode, "no");
  assert.equal(GetProductDetailsInput.parse({ itemNo: "00263850" }).langCode, "en");
  assert.equal(GetProductDetailsInput.parse({ itemNo: "00263850", countryCode: "NO", langCode: "en" }).langCode, "en");
});

// ── inRange ───────────────────────────────────────────────────────────────────

function withRange(inRange: boolean, quantity?: number): StockResponse {
  const base = makeStockResponse();
  const a = base.availabilities![0];
  const cashCarry: typeof a.buyingOption.cashCarry = {
    ...a.buyingOption.cashCarry,
    range: { inRange },
  };
  if (quantity === undefined) {
    // Not in range: the API omits availability entirely.
    delete cashCarry.availability;
  } else {
    cashCarry.availability = { ...a.buyingOption.cashCarry.availability!, quantity };
  }
  return {
    ...base,
    availabilities: [{ ...a, availableForCashCarry: inRange, buyingOption: { ...a.buyingOption, cashCarry } }],
  };
}

test("projectStock — inRange false with no quantity means item not sold here", () => {
  const result = projectStock(withRange(false));
  assert.equal(result.inRange, false);
  assert.equal(result.quantity, null);
  assert.equal(result.availableForCashCarry, false);
  assert.deepEqual(result.errors, []);
});

test("projectStock — inRange true passes through with quantity", () => {
  const result = projectStock(withRange(true, 7));
  assert.equal(result.inRange, true);
  assert.equal(result.quantity, 7);
});

test("projectStock — inRange is null when the API omits range", () => {
  assert.equal(projectStock(makeStockResponse()).inRange, null);
  assert.equal(projectStock(makeStockResponse({ availabilities: [] })).inRange, null);
});

test("projectMultiItemStock — inRange per row, null on 405 and not-found", () => {
  const stocked = projectMultiItemStock(
    { availabilities: [makeAvailability("20522046", 3)], timestamp: "t" },
    ["20522046", "99999999"]
  );
  assert.equal(stocked[0].inRange, null); // makeAvailability has no range
  assert.equal(stocked[1].inRange, null);
  assert.equal(stocked[1].errors[0].code, 404);

  const storeError = projectMultiItemStock(
    { availabilities: null, errors: [{ code: 405, message: "Store not found" }], timestamp: "t" },
    ["20522046"]
  );
  assert.equal(storeError[0].inRange, null);

  const inRange = projectMultiItemStock(withRange(true, 7), ["20522046"]);
  assert.equal(inRange[0].inRange, true);
  const notInRange = projectMultiItemStock(withRange(false), ["20522046"]);
  assert.equal(notInRange[0].inRange, false);
  assert.equal(notInRange[0].quantity, null);
});

test("check_cart_availability — item outside the store's range is insufficient, not a crash", async () => {
  const body = withRange(false);
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
  );
  try {
    const res = await checkCartAvailabilityTool.handler({ storeId: "095", items: [{ itemNo: "20522046", quantity: 1 }] });
    const out = JSON.parse(res.content[0].text) as {
      allSufficient: boolean;
      items: { inStock: number | null; sufficient: boolean; inRange: boolean | null; errors: unknown[] }[];
    };
    assert.equal(out.allSufficient, false);
    assert.equal(out.items[0].inStock, null);
    assert.equal(out.items[0].sufficient, false);
    assert.equal(out.items[0].inRange, false);
    assert.deepEqual(out.items[0].errors, []);
    assert.equal(fetchMock.mock.callCount(), 1);
  } finally {
    fetchMock.mock.restore();
  }
});

// ── list_stores handler and tool schemas ──────────────────────────────────────

async function listStores(args: Record<string, unknown>) {
  const res = await listStoresTool.handler(args);
  return JSON.parse(res.content[0].text) as { stores: { storeId: string; storeLabel: string; countryCode: string }[] };
}

test("list_stores — countryCode NO returns the seven Norwegian stores", async () => {
  const { stores } = await listStores({ countryCode: "NO" });
  assert.deepEqual(stores.map((s) => s.storeId), ["007", "091", "095", "126", "371", "390", "441"]);
  assert.ok(stores.every((s) => s.countryCode === "NO"));
  assert.equal(stores[2].storeLabel, "095 (Furuset, Oslo, NO)");
});

test("list_stores — no filter returns all 74 stores with correct country tags", async () => {
  const { stores } = await listStores({});
  assert.equal(stores.length, 74);
  assert.equal(stores.filter((s) => s.countryCode === "US").length, 52);
  assert.equal(stores.filter((s) => s.countryCode === "CA").length, 15);
  assert.equal(stores.filter((s) => s.countryCode === "NO").length, 7);
  assert.equal(stores.find((s) => s.storeId === "149")?.countryCode, "CA");
  assert.equal(stores.find((s) => s.storeId === "399")?.countryCode, "US");
});

test("list_stores — countryCode CA still returns 15 stores", async () => {
  const { stores } = await listStores({ countryCode: "ca" });
  assert.equal(stores.length, 15);
  assert.ok(stores.every((s) => s.countryCode === "CA"));
});

test("tool schemas — every countryCode enum lists US, CA and NO", () => {
  for (const tool of [listStoresTool, compareStoreStockTool, findBestStoreForItemTool, findBestStoreForCartTool]) {
    const prop = (tool.inputSchema.properties as unknown as Record<string, { enum?: string[] }>).countryCode;
    assert.deepEqual(prop.enum, ["US", "CA", "NO"], `${tool.name} countryCode enum`);
    assert.match(tool.description, /'US', 'CA' or 'NO'/, `${tool.name} description`);
  }
});

test("tool schemas — search tools document the langCode default and no longer hardcode en", () => {
  for (const tool of [searchProductsTool, getProductDetailsTool]) {
    const props = tool.inputSchema.properties as unknown as Record<string, { default?: unknown; description?: string }>;
    assert.equal(props.langCode.default, undefined, `${tool.name} langCode default`);
    assert.match(props.langCode.description ?? "", /no for NO/, `${tool.name} langCode description`);
    assert.equal(props.countryCode.default, "US", `${tool.name} countryCode default`);
  }
});
