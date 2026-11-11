# Contributing

Thanks for helping. This server depends on unofficial IKEA endpoints, so the most useful contributions are the ones
that keep it correct: a store that opened or closed, a country that is missing, a response shape that changed.

## Setup

```bash
npm ci
npm run typecheck
npm test          # unit tests, no network
npm run build
npm run smoke     # the built server against the live IKEA API
```

CI runs the first four on Node 20 and 22. The smoke test also runs once a day on `master`.

## Adding or removing a store

The store catalog is `src/data/stores.ts`. It is edited by hand, because a store's label is part of what the tools
return and should not change by accident.

1. Run `node scripts/audit-catalog.mjs`. It compares the catalog with IKEA's public store list for each country
   and prints what is missing or stale, with a ready-to-paste record for each missing store.
2. Check a missing store against the stock API before adding it: `check_store_stock` with a common item number
   should return a quantity, not `inRange: false`. Plan-and-order points carry no stock and stay out. If a listed
   store must stay out, add it to `EXCLUDED` in the audit script with the reason.
3. Edit `src/data/stores.ts`. Keep the records in store-ID order within their country, and note the change in the
   comment at the top of the file.
4. Run `node scripts/update-store-coordinates.mjs` to regenerate `src/data/store-coordinates.ts`.
5. Update the counts in `test/unit.test.ts` and `README.md`, and the `ADDED_SINCE_V162` / `REMOVED_SINCE_V162`
   lists in the label test. That test freezes every label that existed in v1.6.2.

## Adding a country

[#1](https://github.com/taejin5314/ikea-mcp/pull/1) added Norway and is a good template.

1. `src/data/countries.ts`: add the country code and its default search language.
2. `scripts/feeds.mjs`: add the locale path of that country's ikea.com site to `FEEDS`.
3. `src/data/stores.ts`: add the stores. `node scripts/audit-catalog.mjs` lists them once the feed is added.
   Probe each one against the stock API with an item that country sells.
4. `node scripts/update-store-coordinates.mjs`.
5. Tests: the country's store IDs, its labels, and the `inRange` behaviour for an item from another market.
6. `smoke.mjs`: a search, a stock check and a country-wide comparison for the new country.
7. README: the country table, the limitations and an example.

Item numbers are per market. Use an item found by searching with the new country's code, not a US one.

## Changing a tool

- Inputs are validated with the zod schemas in `src/schemas/index.ts`. The JSON schema each tool advertises is
  written by hand next to its handler; keep the two in step.
- A handler may throw. `callTool` in `src/server.ts` turns anything thrown into a result marked `isError`, so
  write the message for the model that will read it.
- Do not change the keys or meaning of an existing result. Add fields instead, and pin the shape with a test.

## Pull requests

Keep one goal per pull request, say what you ran, and paste the smoke output for anything that touches the live
API. If the change is visible to users, update the README in the same pull request.
