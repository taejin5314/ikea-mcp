// Shared by the catalog scripts: where IKEA publishes each country's store list, and how to read our catalog.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Country code → the locale path of that country's ikea.com site. Add a line here when adding a country. */
export const FEEDS = { US: "us/en", CA: "ca/en", NO: "no/no" };

/** The store records in src/data/stores.ts, as { storeId, countryCode }. */
export function readCatalog() {
  const records = [...readFileSync(join(root, "src/data/stores.ts"), "utf8").matchAll(/\{ storeId: "(\d+)"[^}]*?countryCode: "(\w+)" \}/g)].map(
    (m) => ({ storeId: m[1], countryCode: m[2] })
  );
  if (records.length === 0) throw new Error("no store records found in src/data/stores.ts");
  return records;
}

/** IKEA's public store list for one country: every location, including ones without stock. */
export async function fetchFeed(countryCode) {
  const url = `https://www.ikea.com/${FEEDS[countryCode]}/meta-data/informera/stores-detailed.json`;
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}
