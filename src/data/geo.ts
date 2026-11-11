import type { CountryCode } from "./countries.js";
import { STORES } from "./stores.js";
import { STORE_COORDINATES, type Coordinates } from "./store-coordinates.js";

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface NearbyStore {
  storeId: string;
  countryCode: CountryCode;
  /** Straight-line distance, rounded to one decimal. */
  distanceKm: number;
}

export interface NearestOptions {
  countryCode?: CountryCode;
  limit: number;
  maxDistanceKm?: number;
}

/**
 * Catalog stores closest to a point, nearest first; ties break on storeId.
 * Stores without a known coordinate are left out rather than placed by guess.
 */
export function nearestStores(from: Coordinates, options: NearestOptions): NearbyStore[] {
  return STORES.filter((s) => !options.countryCode || s.countryCode === options.countryCode)
    .flatMap((s) => {
      const at = STORE_COORDINATES[s.storeId];
      return at ? [{ storeId: s.storeId, countryCode: s.countryCode, km: distanceKm(from, at) }] : [];
    })
    .filter((s) => options.maxDistanceKm === undefined || s.km <= options.maxDistanceKm)
    .sort((a, b) => a.km - b.km || a.storeId.localeCompare(b.storeId))
    .slice(0, options.limit)
    .map(({ storeId, countryCode, km }) => ({ storeId, countryCode, distanceKm: Math.round(km * 10) / 10 }));
}
