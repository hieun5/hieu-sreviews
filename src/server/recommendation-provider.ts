import type {
  DiscoveryCandidate,
  RecommendationFilters,
} from "@/contracts/recommendations";

export interface RecommendationProvider {
  readonly name: string;
  // Enable only after checking this provider's actual terms. No universal
  // caching/storage permission or invented expiry period is assumed.
  readonly retention: {
    version: string;
    termsUrl: string;
    permanentIdentifiers: boolean;
    derivedPreferenceScores: boolean;
  };
  discover(input: {
    query: string;
    filters: RecommendationFilters;
    signal?: AbortSignal;
  }): Promise<DiscoveryCandidate[]>;
  getDetails(
    providerPlaceId: string,
    signal?: AbortSignal,
  ): Promise<DiscoveryCandidate>;
}

export function getRecommendationProvider(): RecommendationProvider | null {
  // No provider or credentials have been configured. Live discovery must report
  // this explicitly; journal data is not a substitute for external candidates.
  return null;
}
