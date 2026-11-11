# Changelog

Notable changes to ikea-mcp. Versions follow [semantic versioning](https://semver.org/): a result's existing keys
and meaning do not change within a major version.

## 1.9.0

The first release since 1.6.2. Versions 1.7.0 and 1.8.0 were prepared but never published; their changes ship here.

### Added

- **Norway.** `countryCode: "NO"` on the stock tools, seven Norwegian stores, and Norwegian as the default search
  language for that country. Thanks to [@georglundesgaard](https://github.com/georglundesgaard)
  ([#1](https://github.com/taejin5314/ikea-mcp/pull/1)).
- **Finding stores by place.** `find_nearby_stores` returns the stores closest to a latitude and longitude.
  `find_best_store_for_item` and `find_best_store_for_cart` accept `near` and `nearestStores`: they search only the
  closest stores, add `distanceKm` to each row and rank nearer stores first
  ([#6](https://github.com/taejin5314/ikea-mcp/pull/6)).
- **`inRange`** on stock rows: `false` means the item is not sold at that store or in that market, which used to
  look the same as "unknown" ([#1](https://github.com/taejin5314/ikea-mcp/pull/1)).
- **Ten small-format stores**: San Francisco, Rockwall, Pharr, Chantilly, Scottsdale, Huntsville, Webster, Culver
  City and Tulsa in the US, and London in Canada. The catalog is now 83 stores
  ([#7](https://github.com/taejin5314/ikea-mcp/pull/7)).
- **Tool annotations**: every tool is listed with a title and `readOnlyHint`
  ([#4](https://github.com/taejin5314/ikea-mcp/pull/4)).

### Changed

- **Errors are tool results.** Invalid arguments, upstream failures and timeouts come back as a result marked
  `isError` with a sentence that names the field to fix. They used to reach the client as JSON-RPC `-32603`
  ([#4](https://github.com/taejin5314/ikea-mcp/pull/4)).
- **Requests time out.** Every request to IKEA is abandoned after 10 seconds
  ([#4](https://github.com/taejin5314/ikea-mcp/pull/4)).
- **`langCode` defaults to the country's language** on `search_products` and `get_product_details` when omitted
  ([#1](https://github.com/taejin5314/ikea-mcp/pull/1)).
- The server reports its package version in `serverInfo` instead of `1.0.0`
  ([#3](https://github.com/taejin5314/ikea-mcp/pull/3)).
- With no `storeIds`, `countryCode` or `near`, the ranking tools search every catalog store, which now includes
  Norway and the small-format stores. Pass `near` or `countryCode` to keep a search local.

### Fixed

- `check_cart_availability` threw `Cannot read properties of undefined (reading 'quantity')` for an item not sold
  at the store. It now returns `inStock: null, sufficient: false, inRange: false`
  ([#1](https://github.com/taejin5314/ikea-mcp/pull/1)).

### Removed

- Store 508 (Memphis) from the catalog: IKEA's stock API reports it as inactive
  ([#7](https://github.com/taejin5314/ikea-mcp/pull/7)).

### Project

- CI on Node 20 and 22, a daily smoke test against the live API and a weekly audit of the store catalog, each
  opening an issue when it fails.
- `CONTRIBUTING.md`, and scripts to audit the catalog and regenerate store coordinates.

## 1.6.2 and earlier

See the [commit history](https://github.com/taejin5314/ikea-mcp/commits/v1.6.2).
