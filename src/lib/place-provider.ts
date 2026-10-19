export interface ExternalPlace {
  provider: string;
  providerPlaceId: string;
  name: string;
  address: string;
  categories: string[];
  priceTier?: 1 | 2 | 3 | 4;
  attribution: { text: string; url?: string };
}

// Implement a provider's permitted storage/cache/attribution policy before enabling it.
// External results must never be silently persisted as owned directory data.
export interface PlaceSearchProvider {
  readonly name: string;
  search(query: string, signal?: AbortSignal): Promise<ExternalPlace[]>;
  getDetails(
    providerPlaceId: string,
    signal?: AbortSignal,
  ): Promise<ExternalPlace>;
}

export function getPlaceSearchProvider(): PlaceSearchProvider | null {
  return null; // Deliberately unconfigured; manual entry is a complete supported path.
}
