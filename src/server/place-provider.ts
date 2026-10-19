import type { ExternalPlace } from "@/contracts/journal";

// A provider implementation must apply its attribution, storage and caching
// policies before registration. Search results are never persisted implicitly.
export interface PlaceProviderAdapter {
  readonly name: string;
  search(
    query: string,
    options: { page: number; pageSize: number; signal?: AbortSignal },
  ): Promise<{ data: ExternalPlace[]; total: number }>;
  getDetails(
    providerPlaceId: string,
    signal?: AbortSignal,
  ): Promise<ExternalPlace>;
}

export function getPlaceProvider(): PlaceProviderAdapter | null {
  return null;
}
