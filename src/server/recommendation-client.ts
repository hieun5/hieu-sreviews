import {
  scoringResponseSchema,
  type ScoringInput,
} from "@/contracts/recommendations";
import { ApiError } from "./api-errors";

export function createRecommendationClient(
  config: { url?: string; secret?: string },
  fetcher: typeof fetch = fetch,
) {
  return {
    configured: Boolean(
      config.url && config.secret && config.secret.length >= 32,
    ),
    async score(input: ScoringInput) {
      if (!config.url || !config.secret || config.secret.length < 32)
        throw new ApiError(
          503,
          "RECOMMENDER_UNCONFIGURED",
          "The private recommendation service has not been configured.",
        );
      try {
        const url = new URL("/score", config.url);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw new Error("Invalid service URL");
        const response = await fetcher(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.secret}`,
          },
          body: JSON.stringify(input),
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error("Scoring service rejected request");
        const body = await response.text();
        if (new TextEncoder().encode(body).length > 200_000)
          throw new Error("Scoring response too large");
        const result = scoringResponseSchema.parse(JSON.parse(body)).data;
        const keys = new Set(
          input.candidates.map((candidate) => candidate.key),
        );
        const seen = new Set<string>();
        for (const [index, row] of result.results.entries()) {
          if (
            !keys.has(row.candidateKey) ||
            seen.has(row.candidateKey) ||
            row.rank !== index + 1
          )
            throw new Error("Invalid scored identity or rank");
          seen.add(row.candidateKey);
        }
        if (
          result.results.length > input.limit ||
          result.counts.candidateCount !== input.candidates.length ||
          result.counts.rankedCount !== result.results.length ||
          result.counts.eligibleCount < result.results.length ||
          result.counts.eligibleCount + result.counts.excludedCount !==
            input.candidates.length
        )
          throw new Error("Invalid scoring counts");
        return result;
      } catch {
        // Neither credentials nor upstream bodies are exposed or logged.
        throw new ApiError(
          502,
          "RECOMMENDER_UNAVAILABLE",
          "The recommendation service could not complete this run. No substitute results were generated.",
        );
      }
    },
  };
}
export type RecommendationClient = ReturnType<
  typeof createRecommendationClient
>;
