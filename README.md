# ikea-mcp

Read-only MCP server for IKEA product search and in-store stock lookup.

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
  "storeId": "448",
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

## Build and test

```bash
npm install
npm run build        # tsc → dist/
npm run typecheck    # type-check without emit
npm test             # unit tests
node smoke.mjs       # end-to-end stdio smoke test
```

`smoke.mjs` exercises all 3 tools against the live IKEA API and prints pass/fail lines to stdout.

## Limitations

- US store IDs only (tested; other country codes are untested).
- Uses unofficial public IKEA APIs — no SLA, no auth required, may break without notice.
- Read-only: no cart, no order, no account operations.
- `compare_store_stock` fires all store requests in parallel — large `storeIds` arrays may hit rate limits.
- Click-and-collect and home-delivery availability are not exposed (cash-and-carry only).
- `size` in `search_products` is capped by IKEA's API (observed max ~24 per page; `total` reflects the full catalogue count).
