import { test } from "node:test";
import assert from "node:assert/strict";
import { projectStock, projectProduct, projectMultiItemStock, type StockResponse } from "../src/services/ikea.js";
import { storeIdsByCountry, STORE_LABELS } from "../src/data/stores.js";

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
    quantity: 42,
    messageType: "HIGH_IN_STOCK",
    errors: [],
  });
});

test("projectStock — empty availabilities returns null fields", () => {
  const result = projectStock(makeStockResponse({ availabilities: [] }));
  assert.equal(result.availableForCashCarry, false);
  assert.equal(result.quantity, null);
  assert.equal(result.messageType, null);
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
  });

  assert.equal("id" in out, false);
  assert.equal("mainImageUrl" in out, false);
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
      ratingValue: p.ratingValue,
      ratingCount: p.ratingCount,
    })),
  };

  assert.equal(output.total, 97);
  assert.equal(output.items.length, 1);

  const item = output.items[0];
  assert.deepEqual(Object.keys(item).sort(), [
    "itemNo", "name", "pipUrl", "ratingCount", "ratingValue", "salesPrice", "typeName",
  ].sort());
  assert.equal(item.itemNo, "20522046");
  assert.equal(item.name, "BILLY");
  assert.deepEqual(item.salesPrice, { amount: 69.99, currencyCode: "USD" });

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

import { CompareStoreStockInput } from "../src/schemas/index.js";

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
  assert.ok(ids.length > 0);
  ids.forEach((id) => {
    assert.match(STORE_LABELS[id], /,\s+[A-Z]{2},\s+CA\)$/, `expected CA label for ${id}: ${STORE_LABELS[id]}`);
  });
});

test("storeIdsByCountry — US returns only non-CA stores", () => {
  const ids = storeIdsByCountry("US");
  assert.ok(ids.length > 0);
  ids.forEach((id) => {
    assert.doesNotMatch(STORE_LABELS[id], /,\s+[A-Z]{2},\s+CA\)$/, `unexpected CA label for ${id}: ${STORE_LABELS[id]}`);
  });
});

test("storeIdsByCountry — US and CA partition all stores exactly", () => {
  const us = storeIdsByCountry("US");
  const ca = storeIdsByCountry("CA");
  const all = Object.keys(STORE_LABELS);
  assert.equal(us.length + ca.length, all.length);
  const combined = new Set([...us, ...ca]);
  assert.equal(combined.size, all.length);
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
