import { test } from "node:test";
import assert from "node:assert/strict";
import { projectStock, type StockResponse } from "../src/services/ikea.js";

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
