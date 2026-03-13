# ikea-mcp

Read-only MCP server for IKEA product search and in-store stock lookup.

**Transports:** stdio (Claude Desktop / MCP CLI) · Streamable HTTP (remote clients)  
**License:** MIT · **No auth required to run locally**

## Capabilities
| Tool | What it does |
|---|---|
| `search_products` | Search IKEA products by keyword |
| `get_product_details` | Get details for a single product by item number |
| `check_store_stock` | Check cash-and-carry stock at one store |
| `check_multi_item_stock` | Check stock for multiple items at one store |
| `compare_store_stock` | Compare stock across multiple stores |
| `find_best_store_for_item` | Rank stores by in-stock quantity |

## MVP limitations
- Uses unofficial public IKEA APIs — no SLA, may break without notice
- ~65 confirmed US and Canada stores in catalog (`src/data/stores.ts`); some IDs remain unverified
- Cash-and-carry availability only — click-and-collect and home delivery not exposed
- HTTP transport is open by default — set `API_KEY` env var to require `x-api-key` header on `/mcp`
- Read-only — no cart, order, or account operations

## Tools

### `search_products`

Search IKEA products by keyword.

**Input**
| param | type | default | required |
|---|---|---|---|
| `query` | string | — | yes |
| `countryCode` | string | `"us"` | no |
| `langCode` | string | `"en"` | no |
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
| `countryCode` | string | `"us"` | no |
| `langCode` | string | `"en"` | no |

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
| `countryCode` | string | `"us"` | no |

**Output**
```json
{
  "storeId": "399",
  "availableForCashCarry": true,
  "quantity": 110,
  "messageType": "HIGH_IN_STOCK",
  "errors": null
}
```

On error (e.g. item not carried):
```json
{
  "storeId": "026",
  "availableForCashCarry": false,
  "quantity": null,
  "messageType": null,
  "errors": [{ "code": 404, "message": "Not found", "meaning": "item not stocked at this store" }]
}
```

---

### `compare_store_stock`

Compare stock for one item across multiple stores.

**Input**
| param | type | default | required |
|---|---|---|---|
| `itemNo` | string | — | yes |
| `storeIds` | string[] (min 2) | — | yes |
| `countryCode` | string | `"us"` | no |

**Output** — array of the same shape as `check_store_stock` (one entry per store).

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
| `maxResults` | number | `3` (max 10) | no |

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

Returns `[]` if no store has the item in stock. "All known stores" means the ~65 US and Canada entries in `src/data/stores.ts`.

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

Returns the top 3 stores by in-stock quantity across the mixed US/Canada subset. Omit `storeIds` to search all ~65 known stores.

---

## Build and test

```bash
npm install
npm run build        # tsc → dist/
npm run typecheck    # type-check without emit
npm test             # unit tests
node smoke.mjs       # end-to-end stdio smoke test
```

`smoke.mjs` exercises all 4 tools against the live IKEA API and prints pass/fail lines to stdout.

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

## Connecting a local MCP client (stdio)

**Claude Desktop** (`claude_desktop_config.json`):
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

---

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

Store metadata (ID → city label) lives in `src/data/stores.ts`. ~50 US stores confirmed from `ikea.com/us/en/stores/` pages; 15 Canada stores confirmed from `ikea.com/ca/en/stores/` pages (all probed against the stock API).

Confirmed compatible `storeId` formats:
- Standard 3-digit: `"399"` (Burbank, CA, US), `"216"` (Calgary, AB, CA)
- Leading-zero 3-digit: `"026"` (Canton, MI, US), `"039"` (Montreal, QC, CA)
- 4-digit: `"921"` (Brooklyn, NY, US), `"1129"` (Syracuse, NY, US)

Some stores remain unconfirmed (no store page ID found or not yet probed). A few valid-looking IDs from the stock API have no known city mapping — see TODO comments in `stores.ts`.

An invalid or unsupported `storeId` returns a 405 error in the `errors` array.

## Limitations

- Uses unofficial public IKEA APIs — no SLA, no auth required, may break without notice.
- Read-only: no cart, no order, no account operations.
- `compare_store_stock` fires all store requests in parallel — large `storeIds` arrays may hit rate limits.
- Click-and-collect and home-delivery availability are not exposed (cash-and-carry only).
- `size` in `search_products` is capped by IKEA's API (observed max ~24 per page; `total` reflects the full catalogue count).
