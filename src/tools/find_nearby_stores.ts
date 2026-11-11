import { FindNearbyStoresInput } from "../schemas/index.js";
import { nearestStores } from "../data/geo.js";
import { storeLabel } from "../data/stores.js";
import { COUNTRY_CODES } from "../data/countries.js";

export const findNearbyStoresTool = {
  name: "find_nearby_stores",
  description:
    "Find the IKEA stores closest to a place. Pass the latitude and longitude of the user's city or address (an approximate city-centre coordinate is fine). Returns stores nearest first with the straight-line distance in km. Use the returned storeId values with the stock tools, or pass the same coordinates as `near` to find_best_store_for_item / find_best_store_for_cart.",
  inputSchema: {
    type: "object",
    properties: {
      latitude: { type: "number", minimum: -90, maximum: 90, description: "Latitude in decimal degrees, e.g. 43.65 for Toronto." },
      longitude: { type: "number", minimum: -180, maximum: 180, description: "Longitude in decimal degrees, e.g. -79.38 for Toronto." },
      countryCode: { type: "string", enum: [...COUNTRY_CODES], description: "Only return stores in this country." },
      maxResults: { type: "number", default: 5, description: "How many stores to return (1–20)." },
      maxDistanceKm: { type: "number", description: "Leave out stores farther than this." },
    },
    required: ["latitude", "longitude"],
  },
  async handler(rawInput: unknown) {
    const input = FindNearbyStoresInput.parse(rawInput);
    const stores = nearestStores(
      { lat: input.latitude, lon: input.longitude },
      { countryCode: input.countryCode, limit: input.maxResults, maxDistanceKm: input.maxDistanceKm }
    ).map((s) => ({
      storeId: s.storeId,
      storeLabel: storeLabel(s.storeId) ?? s.storeId,
      countryCode: s.countryCode,
      distanceKm: s.distanceKm,
    }));
    return { content: [{ type: "text", text: JSON.stringify({ stores }, null, 2) }] };
  },
};
