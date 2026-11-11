import type { CountryCode } from "../data/countries.js";
import { nearestStores } from "../data/geo.js";
import { allStoreIds, storeIdsByCountry } from "../data/stores.js";

export interface TargetInput {
  storeIds?: string[];
  countryCode?: CountryCode;
  near?: { latitude: number; longitude: number };
  nearestStores: number;
}

export interface Targets {
  storeIds: string[];
  /** storeId → straight-line km from `near`; empty when `near` was not used. */
  distances: Map<string, number>;
}

/**
 * The stores a ranking tool should search. Explicit storeIds win; then the stores closest to `near`
 * (within countryCode when both are given); then every store in countryCode; then the whole catalog.
 */
export function resolveTargets(input: TargetInput): Targets {
  if (input.storeIds) return { storeIds: input.storeIds, distances: new Map() };
  if (input.near) {
    const nearest = nearestStores(
      { lat: input.near.latitude, lon: input.near.longitude },
      { countryCode: input.countryCode, limit: input.nearestStores }
    );
    return { storeIds: nearest.map((s) => s.storeId), distances: new Map(nearest.map((s) => [s.storeId, s.distanceKm])) };
  }
  return { storeIds: input.countryCode ? storeIdsByCountry(input.countryCode) : allStoreIds(), distances: new Map() };
}
