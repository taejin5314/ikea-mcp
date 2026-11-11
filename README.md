# ikea-mcp

[![npm](https://img.shields.io/npm/v/ikea-mcp)](https://www.npmjs.com/package/ikea-mcp)
[![node](https://img.shields.io/node/v/ikea-mcp)](package.json)
[![license](https://img.shields.io/npm/l/ikea-mcp)](LICENSE)
[![CI](https://github.com/taejin5314/ikea-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/taejin5314/ikea-mcp/actions/workflows/ci.yml)
[![Live smoke](https://github.com/taejin5314/ikea-mcp/actions/workflows/live-smoke.yml/badge.svg)](https://github.com/taejin5314/ikea-mcp/actions/workflows/live-smoke.yml)

An MCP server that lets an AI assistant search IKEA products and check live in-store stock in the US, Canada and Norway.
Ask "which store near me has everything on this list?" and the assistant answers from IKEA's own stock data.

Read-only, no account or API key needed, runs with one `npx` command.

## Quick start

Add it to Claude Desktop (`claude_desktop_config.json`), Claude Code (`.mcp.json`) or any MCP client that speaks
stdio:

```json
{
  "mcpServers": {
    "ikea-mcp": {
      "command": "npx",
      "args": ["-y", "ikea-mcp"]
    }
  }
}
```

Then ask in plain language:

> Find the white BILLY bookcase and tell me which store near Toronto has it in stock.

## What it answers

These are real responses from the published package against the live IKEA API, captured on 11 November 2026. Each
call took under 400 ms, including the one that asks all 15 Canadian stores.

`search_products` `{ "query": "BILLY bookcase", "countryCode": "CA", "size": 3 }`

```json
{
  "total": 120,
  "items": [
    {
      "itemNo": "20522046",
      "name": "BILLY",
      "typeName": "Bookcase",
      "salesPrice": { "amount": 90, "currencyCode": "CAD" },
      "pipUrl": "https://www.ikea.com/ca/en/p/billy-bookcase-white-20522046/",
      "ratingValue": 4.5,
      "ratingCount": 2124
    }
  ]
}
```

`find_best_store_for_item` `{ "itemNo": "20522046", "countryCode": "CA", "maxResults": 3 }`

```json
[
  { "storeId": "003", "storeLabel": "003 (Richmond, BC, CA)", "quantity": 565, "messageType": "HIGH_IN_STOCK" },
  { "storeId": "372", "storeLabel": "372 (Vaughan, ON, CA)", "quantity": 111, "messageType": "HIGH_IN_STOCK" },
  { "storeId": "216", "storeLabel": "216 (Calgary, AB, CA)", "quantity": 94, "messageType": "HIGH_IN_STOCK" }
]
```

`find_best_store_for_cart` with two BILLY sizes, ranked by how much of the cart each store can fill:

```json
[
  {
    "storeId": "003",
    "storeLabel": "003 (Richmond, BC, CA)",
    "allSufficient": true,
    "fulfilledCount": 2,
    "totalCount": 2,
    "items": [
      { "itemNo": "20522046", "quantity": 2, "inStock": 565, "sufficient": true },
      { "itemNo": "50522040", "quantity": 1, "inStock": 17, "sufficient": true }
    ]
  }
]
```

(Output shortened: the first shows one of three items and omits `imageUrl`, the second omits
`availableForCashCarry`, the third shows one of two stores.)

## Tools

| Tool                       | What it does                                                           |
| -------------------------- | ---------------------------------------------------------------------- |
| `search_products`          | Search IKEA products by keyword                                        |
| `get_product_details`      | Get details for a single product by item number                        |
| `list_stores`              | List known store IDs and labels, optionally filtered by country        |
| `find_nearby_stores`       | Find the stores closest to a place, with the distance in km            |
| `check_store_stock`        | Check cash-and-carry stock at one store                                |
| `check_multi_item_stock`   | Check stock for multiple items at one store                            |
| `compare_store_stock`      | Compare stock across explicit stores or a whole country                |
| `find_best_store_for_item` | Rank stores by in-stock quantity, or the nearest stores that have it   |
| `check_cart_availability`  | Check whether every item in a shopping list is available at one store  |
| `find_best_store_for_cart` | Rank stores by how much of a multi-item cart they can fill             |

## Finding stores by place

Nobody knows IKEA store IDs, so the ranking tools take a place. Pass `near` with the latitude and longitude of the
user's city (an assistant can supply an approximate city-centre coordinate) and they search only the closest stores
and answer nearest first:

`find_best_store_for_item` `{ "itemNo": "20522046", "near": { "latitude": 43.65, "longitude": -79.38 } }`

```json
[
  { "storeId": "256", "storeLabel": "256 (Etobicoke, ON, CA)", "quantity": 71, "messageType": "HIGH_IN_STOCK", "distanceKm": 12.9 },
  { "storeId": "149", "storeLabel": "149 (North York, ON, CA)", "quantity": 59, "messageType": "HIGH_IN_STOCK", "distanceKm": 13.1 },
  { "storeId": "372", "storeLabel": "372 (Vaughan, ON, CA)", "quantity": 107, "messageType": "HIGH_IN_STOCK", "distanceKm": 19.5 }
]
```

(Captured against the live API on 11 November 2026; `availableForCashCarry` omitted.)

- `near` searches the 5 closest stores by default; set `nearestStores` (1–20) to widen it. Add `countryCode` to stay
  inside one country near a border.
- Which stores are searched: explicit `storeIds`, else the stores closest to `near`, else every store in
  `countryCode`, else the whole catalog.
- `find_nearby_stores` returns just the stores and distances, without a stock lookup.
- Distances are straight-line. Coordinates come from IKEA's public store lists and are generated by
  `scripts/update-store-coordinates.mjs`; a store without a known coordinate is left out of distance searches.

## How it is built

- **Two transports from one server.** stdio for local clients and stateless Streamable HTTP for remote ones, with
  optional `x-api-key` auth on `/mcp` and an open `/health` endpoint.
- **Fan-out with limits.** A country-wide query asks every store in parallel, capped at 10 concurrent requests,
  with one retry on 5xx, 429 or network errors and `Retry-After` respected.
- **Errors that mean something.** A 404 is "not stocked here", a 405 is "not a valid store" and `inRange: false`
  is "not sold in this market"; each comes back as data on the row instead of failing the whole call, so an
  assistant can explain a partial answer.
- **Failures the assistant can read.** Invalid arguments and upstream failures come back as tool results marked
  `isError`, naming the field to fix, instead of protocol errors a client may hide. Every request to IKEA times out
  after 10 seconds.
- **Declared read-only.** Every tool carries MCP annotations (`readOnlyHint`, a title), so clients know they
  change nothing.
- **Watched daily.** A scheduled job runs the smoke test against the live API and opens an issue when IKEA changes
  something. A weekly job compares the store catalog with IKEA's own store lists and opens an issue when a store
  opens or closes.
- **Forgiving input.** Item numbers are accepted as `20522046`, `005.221.32` or `5-221-32` and normalised.
- **Small surface.** Two runtime dependencies (the MCP SDK and zod), inputs validated with zod schemas, unit tests
  on the logic and smoke tests over both transports against the live API.

## Limitations

- Uses unofficial public IKEA APIs: no SLA, and it may break without notice.
- US, Canada and Norway only: 60 US stores, 16 in Canada and 7 in Norway, which is every store and small-format
  store IKEA lists as selling cash-and-carry in those countries. Plan-and-order points are excluded because they
  carry no stock, and so is the Østfold small store in Norway, whose stock the API does not report.
- Cash-and-carry availability only: click-and-collect and home delivery are not exposed.
- Read-only: no cart, order or account operations.
- `size` in `search_products` is capped by IKEA's API (observed maximum about 24 per page; `total` is the full
  catalogue count).
- The HTTP transport is open by default. Set the `API_KEY` environment variable to require an `x-api-key` header
  on `/mcp`.

## Tool reference

### `search_products`

Search IKEA products by keyword.

**Input**
| param | type | default | required |
|---|---|---|---|
| `query` | string | — | yes |
| `countryCode` | string | `"US"` | no |
| `langCode` | string | country default: `"en"` for US/CA, `"no"` for NO | no |
| `size` | number | `10` | no |

**Output**
```json
{
  "total": 97,
  "items": [
    {
      "itemNo": "20522046",
      "name": "BILLY",
      "typeName": "Bookcase",
      "salesPrice": { "amount": 69.99, "currencyCode": "USD" },
      "pipUrl": "https://www.ikea.com/us/en/p/...",
      "ratingValue": 4.8,
      "ratingCount": 1234
    }
  ]
}
```

---

### `get_product_details`

Get details for a single IKEA product by item number.

**Input**
| param | type | default | required |
|---|---|---|---|
| `itemNo` | string | — | yes |
| `countryCode` | string | `"US"` | no |
| `langCode` | string | country default: `"en"` for US/CA, `"no"` for NO | no |

**Output**
```json
{
  "itemNo": "20522046",
  "name": "BILLY",
  "typeName": "Bookcase",
  "salesPrice": { "amount": 79, "currencyCode": "USD" },
  "pipUrl": "https://www.ikea.com/us/en/p/billy-bookcase-white-20522046/",
  "designText": "white",
  "measureText": "31 1/2x11x79 1/2 \"",
  "ratingValue": 4.6,
  "ratingCount": 2620
}
```

> `shortDescription` and `materials` are not available from the underlying API.

---

### `check_store_stock`

Check stock at a single IKEA store.

**Input**
| param | type | default | required |
|---|---|---|---|
| `itemNo` | string | — | yes |
| `storeId` | string | — | yes |
| `countryCode` | string | `"US"` | no |

**Output**
```json
{
  "storeId": "399",
  "availableForCashCarry": true,
  "inRange": true,
  "quantity": 110,
  "messageType": "HIGH_IN_STOCK",
  "errors": []
}
```

On error (e.g. item not carried):
```json
{
  "storeId": "026",
  "availableForCashCarry": false,
  "inRange": null,
  "quantity": null,
  "messageType": null,
  "errors": [{ "code": 404, "message": "Not found", "meaning": "item not stocked at this store" }]
}
```

`inRange: false` with an empty `errors` array means the item is not sold at that store or in that country's market (for example a US item number checked against a Norwegian store). Search with the matching `countryCode` to get a local item number.

---

### `compare_store_stock`

Compare stock for one item across multiple stores. Provide explicit `storeIds`, or use `countryCode` to expand to all catalog stores for that country. At least one of `storeIds` or `countryCode` is required.

**Input**
| param | type | default | required |
|---|---|---|---|
| `itemNo` | string | — | yes |
| `storeIds` | string[] (min 2) | — | one of `storeIds`/`countryCode` |
| `countryCode` | `"US"` \| `"CA"` \| `"NO"` | — | one of `storeIds`/`countryCode` |
| `sortBy` | `"quantity"` \| `"storeId"` | — | no |

`storeIds` takes precedence — if both are provided, `countryCode` only sets the IKEA API locale.
`sortBy: "quantity"` sorts descending, null quantities last, `storeId` as tie-breaker. `sortBy: "storeId"` sorts ascending. Omitting `sortBy` preserves input order.

**Examples**
```json
{ "itemNo": "20522046", "storeIds": ["399", "026", "921"] }
```
```json
{ "itemNo": "20522046", "countryCode": "CA" }
```

**Output** — array of the same shape as `check_store_stock` (one entry per store).

**Detecting partial failures:** rows with `errors` containing any code other than `404` indicate a store-level or API failure (e.g. `405` = invalid store ID). Rows with only `404` errors mean the item is simply not stocked at that store — this is expected, not a failure.

---

### `check_multi_item_stock`

Check cash-and-carry stock for multiple items at a single store in one call.

**Input**
| param | type | default | required |
|---|---|---|---|
| `storeId` | string | — | yes |
| `itemNos` | string[] (min 1, max 20) | — | yes |

**Output** — array of per-item stock entries in the same order as `itemNos`:

```json
[
  {
    "itemNo": "20522046",
    "storeId": "399",
    "storeLabel": "399 (Burbank, CA)",
    "availableForCashCarry": true,
    "inRange": true,
    "quantity": 104,
    "messageType": "HIGH_IN_STOCK",
    "errors": []
  }
]
```

Items not stocked at that store appear with `availableForCashCarry: false`, `quantity: null`, and a 404 error entry. An invalid `storeId` (405) returns that error on every entry.

---

### `find_best_store_for_item`

Find stores with the highest in-stock quantity for an item. Queries stores in parallel, excludes invalid stores (405), out-of-stock stores (404), and stores with unknown quantity. Results sorted by quantity descending; ties broken by `storeId` lexicographically.

**Input**
| param | type | default | required |
|---|---|---|---|
| `itemNo` | string | — | yes |
| `storeIds` | string[] | all known stores | no |
| `maxResults` | number | `3` (max 50) | no |
| `countryCode` | `"US"` \| `"CA"` \| `"NO"` | — | no |
| `minQuantity` | number (int ≥ 1) | — | no |

`storeIds` takes precedence. If only `countryCode` is given, searches all catalog stores for that country. If neither is given, searches all 83 known stores. `minQuantity` excludes stores with quantity below the threshold.

**Output** — array of matching stores, up to `maxResults`:
```json
[
  {
    "storeId": "399",
    "storeLabel": "399 (Burbank, CA)",
    "availableForCashCarry": true,
    "quantity": 104,
    "messageType": "HIGH_IN_STOCK"
  }
]
```

Returns `[]` if no store has the item in stock. "All known stores" means the 83 US, Canada and Norway entries in `src/data/stores.ts`.

**Note on failures:** stores that return a store-level error (405 invalid store ID) are silently excluded from results rather than appearing as rows. Use `compare_store_stock` with the same `storeIds` to inspect per-store `errors` directly.

---

### `check_cart_availability`

Check whether all items in a shopping list are available in sufficient quantity at a single IKEA store.

**Input**
| param | type | default | required |
|---|---|---|---|
| `storeId` | string | — | yes |
| `items` | array of `{ itemNo, quantity }` | — | yes |
| `items[].itemNo` | string | — | yes |
| `items[].quantity` | number | `1` | no |

**Output**
```json
{
  "storeId": "399",
  "storeLabel": "399 (Burbank, CA)",
  "allSufficient": true,
  "items": [
    {
      "itemNo": "20522046",
      "quantity": 2,
      "inStock": 42,
      "inRange": true,
      "sufficient": true,
      "eligibleForStockNotification": false,
      "errors": []
    }
  ]
}
```

`allSufficient` is `true` only when every item has `sufficient: true`. Items not stocked appear with `inStock: null` and a 404 error. An invalid `storeId` (405) propagates to all items.

---

### `find_best_store_for_cart`

Find the best store to buy multiple items in one trip. Ranks stores by how many cart items are available in sufficient quantity, then by total in-stock sum. Optionally filter by `countryCode` or provide explicit `storeIds`.

**Input**
| param | type | default | required |
|---|---|---|---|
| `items` | array of `{ itemNo, quantity }` | — | yes |
| `items[].itemNo` | string | — | yes |
| `items[].quantity` | number | `1` | no |
| `storeIds` | string[] | — | no |
| `countryCode` | `"US"` \| `"CA"` \| `"NO"` | — | no |
| `maxResults` | number | `3` (max 50) | no |

`storeIds` takes precedence. If only `countryCode` is given, searches all catalog stores for that country. If neither is given, searches all 83 known stores.

**Output** — array of stores ranked by cart fulfillment, up to `maxResults`:
```json
[
  {
    "storeId": "399",
    "storeLabel": "399 (Burbank, CA)",
    "allSufficient": true,
    "fulfilledCount": 3,
    "totalCount": 3,
    "items": [
      { "itemNo": "20522046", "quantity": 2, "inStock": 42, "sufficient": true },
      { "itemNo": "40477340", "quantity": 1, "inStock": 5, "sufficient": true },
      { "itemNo": "89268919", "quantity": 1, "inStock": 12, "sufficient": true }
    ]
  }
]
```

`fulfilledCount` = number of items with `sufficient: true`. Sorting: `fulfilledCount` desc → total stock desc → `storeId` asc. Stores with invalid IDs (405) are excluded.

---

## Example workflows

### 1. Search → inspect → check one store

```
1. search_products       { "query": "BILLY bookcase" }
   → pick itemNo from results, e.g. "20522046"

2. get_product_details   { "itemNo": "20522046" }
   → confirms name, price, dimensions before checking stock

3. check_store_stock     { "itemNo": "20522046", "storeId": "399" }
   → { "availableForCashCarry": true, "quantity": 95, "messageType": "HIGH_IN_STOCK" }
```

### 2. Shopping list at one store

Check whether several items are available in a single trip:

```json
{
  "tool": "check_multi_item_stock",
  "storeId": "399",
  "itemNos": ["20522046", "40477340", "89268919"]
}
```

Returns one entry per item in the same order — items not stocked appear with `availableForCashCarry: false` and a 404 error.

### 3. Best store from a mixed US + Canada subset

```json
{
  "tool": "find_best_store_for_item",
  "itemNo": "20522046",
  "storeIds": ["399", "039", "216", "149", "026"],
  "maxResults": 3
}
```

Returns the top 3 stores by in-stock quantity across the mixed US/Canada subset. Omit `storeIds` to search all 74 known stores.

### 4. Best store for a shopping list

Find which store can fulfill the most items from a multi-item cart:

```json
{
  "tool": "find_best_store_for_cart",
  "items": [
    { "itemNo": "20522046", "quantity": 2 },
    { "itemNo": "40477340", "quantity": 1 },
    { "itemNo": "89268919", "quantity": 1 }
  ],
  "countryCode": "CA",
  "maxResults": 3
}
```

Returns the top 3 Canada stores ranked by how many items they can fully supply. Use `check_cart_availability` to then verify exact quantities at the chosen store.

### 5. Norway: search in Norwegian, then compare every Norwegian store

```
1. search_products       { "query": "billy bokhylle", "countryCode": "NO" }
   → Norwegian names and NOK prices; langCode defaults to "no"

2. compare_store_stock   { "itemNo": "00263850", "countryCode": "NO" }
   → one row per Norwegian store, labelled like "095 (Furuset, Oslo, NO)"
```

---

## Build and test

```bash
npm install
npm run build        # tsc → dist/
npm run typecheck    # type-check without emit
npm test             # unit tests
node smoke.mjs       # end-to-end stdio smoke test
```

`smoke.mjs` (`npm run smoke`) drives the built server over stdio against the live IKEA API, including five Norway steps, and prints pass/fail lines to stdout; `smoke-http.mjs` does the same over HTTP.

## Transports

**stdio** (default — for Claude Desktop / MCP CLI):
```bash
npx ikea-mcp          # after npm install (uses bin entry)
node dist/index.js    # after local build
npm run dev           # dev (tsx, no build needed)
```

**Streamable HTTP** (for remote / network clients):
```bash
node dist/http.js          # listens on http://localhost:3000/mcp
PORT=8080 node dist/http.js
# or during dev:
npm run dev:http
```

Requests must include `Accept: application/json, text/event-stream`. Stateless — no session management.

## Deploy (HTTP transport)

Tested target: **Railway** (also works on Render, Heroku, or any Procfile-aware host).

```bash
# 1. build
npm install && npm run build

# 2. run (Procfile: web: node dist/http.js)
#    PORT is set automatically by the host
node dist/http.js
```

The `Procfile` in the repo root declares `web: node dist/http.js`. `PORT` is read from the environment (default `3000`). No other env vars required.

Endpoints after deploy:
- `POST /mcp` — MCP Streamable HTTP (requires `Accept: application/json, text/event-stream`)
- `GET /health` — returns `{"status":"ok"}`

> **Security note:** Set `API_KEY` to protect the `/mcp` endpoint. Requests without a matching `x-api-key` header return 401. `/health` is always open. The server is read-only — no cart, order, or account operations are possible.
>
> ```bash
> API_KEY=your-secret node dist/http.js
> ```

## Connecting a remote MCP client (HTTP)

Point your MCP client at `https://<your-host>/mcp`.

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "ikea-mcp": {
      "type": "http",
      "url": "https://<your-host>/mcp"
    }
  }
}
```

**`.mcp.json`** (project-local, Claude Code):
```json
{
  "mcpServers": {
    "ikea-mcp": {
      "type": "http",
      "url": "https://<your-host>/mcp"
    }
  }
}
```

**Manual / curl** (for debugging):
```bash
curl -X POST https://<your-host>/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

The `Accept: application/json, text/event-stream` header is required by the MCP SDK — requests without it will be rejected with a `-32000` error.

## Store IDs

Store metadata (ID → city label) lives in `src/data/stores.ts`. 60 US stores confirmed from `ikea.com/us/en/stores/` pages and IKEA's public store list; 16 Canada stores confirmed from `ikea.com/ca/en/stores/` pages (all probed against the stock API). 7 Norway stores confirmed from `ikea.com/no/no/stores/` pages (store code in the page's embedded business-unit JSON), all probed against the stock API.

Confirmed compatible `storeId` formats:
- Standard 3-digit: `"399"` (Burbank, CA, US), `"216"` (Calgary, AB, CA)
- Leading-zero 3-digit: `"026"` (Canton, MI, US), `"039"` (Montreal, QC, CA)
- 4-digit: `"921"` (Brooklyn, NY, US), `"1129"` (Syracuse, NY, US)

Norwegian IDs use the same 3-digit formats, e.g. `"095"` (Furuset, Oslo, NO) and the leading-zero `"007"` (Sørlandet, Kristiansand, NO).

An invalid or unsupported `storeId` returns a 405 error in the `errors` array.

## Item numbers

`itemNo` fields accept several formats — all are normalised to 8 digits internally:

| Input | Normalised |
|---|---|
| `"20522046"` | `"20522046"` |
| `"522132"` | `"00522132"` |
| `"005.221.32"` | `"00522132"` |
| `"5-221-32"` | `"00522132"` |

6- and 7-digit inputs are left-padded to 8 digits. 8- and 9-digit inputs are kept as-is. Values outside 6–9 digits after stripping are rejected.

Item numbers are per market. An item found with `countryCode: "US"` may not exist in the Norwegian range; stock tools then return `inRange: false`. Search with the country you intend to shop in.

## Supported countries

| Country | Code | Store count |
|---|---|---|
| United States | `US` | 60 |
| Canada | `CA` | 16 |
| Norway | `NO` | 7 |

Use `list_stores` to get the current catalog. Every store in it answered the stock API when it was added, and a weekly job checks the catalog against IKEA's store lists. To add a store or a country, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Rate limits & reliability

- Fan-out requests (country-wide `compare_store_stock` / `find_best_store_for_item`) are capped at **10 concurrent** outbound requests.
- `fetchJson` retries **once** after 500 ms on 5xx, 429, or network errors. 404 and 405 are not retried (they are semantic responses, not transient failures).
- `Retry-After` header is respected for 429 responses.
- Do not use in high-frequency loops — the upstream IKEA API has no published rate limit but will block repeated bursts.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `405` in `errors` | Invalid `storeId` — use `list_stores` to find valid IDs |
| `404` in `errors` | Item not stocked at that store |
| `inRange: false`, empty `errors` | Item not sold at that store or in that market — search with the matching `countryCode` |
| Empty `find_best_store_for_item` result | No store has the item in stock, or `minQuantity` is too high |
| Slow `countryCode` query | Normal — fan-out to all country stores (capped at 10 concurrent) |
| `itemNo` validation error | Input must resolve to 6–9 digits; see Item numbers above |
