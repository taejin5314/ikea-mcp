// Compares src/data/stores.ts with IKEA's public store lists and reports drift.
// Usage: node scripts/audit-catalog.mjs      (exits 1 when the catalog is out of date)
//
// A location belongs in the catalog when IKEA lists it as a store or small store that sells cash-and-carry.
// Plan-and-order points carry no stock and are left out. The catalog is edited by hand, because a store's
// label is part of the tools' output; this script only says what to change.
import { FEEDS, fetchFeed, readCatalog } from "./feeds.mjs";

/** Listed by IKEA as selling cash-and-carry, but left out on purpose. storeId → reason. */
const EXCLUDED = {
  "1352": "IKEA Østfold: the stock API reports no cash-and-carry range (probed 2026-11-11)",
};

const catalog = readCatalog();
const problems = [];

for (const countryCode of Object.keys(FEEDS)) {
  const feed = await fetchFeed(countryCode);
  const feedIds = new Set(feed.map((s) => String(s.id)));
  const mine = new Set(catalog.filter((s) => s.countryCode === countryCode).map((s) => s.storeId));

  for (const store of feed) {
    const id = String(store.id);
    const sellsStock = ["STORE", "SMALL"].includes(store.buClassification?.code) && store.cashAndCarry === true && !store.hideStore;
    if (!sellsStock || mine.has(id) || EXCLUDED[id]) continue;
    const region = (store.address?.stateProvinceCode ?? "").replace(/^(US|CA)/, "").trim();
    problems.push(
      `MISSING ${countryCode} ${id}: ${store.name} (${store.address?.city ?? "?"})\n` +
        `        { storeId: "${id}", city: "${store.address?.city ?? ""}"${region ? `, region: "${region}"` : ""}, countryCode: "${countryCode}" },`
    );
  }
  for (const id of mine) {
    if (!feedIds.has(id)) problems.push(`STALE   ${countryCode} ${id}: in the catalog but no longer in IKEA's store list`);
  }
  console.log(`${countryCode}: IKEA lists ${feed.length} locations, the catalog has ${mine.size}`);
}

if (problems.length) {
  console.log(`\nThe catalog is out of date (${problems.length}):\n` + problems.join("\n"));
  console.log("\nProbe a missing store against the stock API before adding it, then run scripts/update-store-coordinates.mjs.");
  process.exit(1);
}
console.log("\nThe catalog matches IKEA's store lists.");
