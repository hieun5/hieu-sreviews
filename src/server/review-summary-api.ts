import { createHash } from "node:crypto";
import {
  REVIEW_SUMMARY_PROMPT_VERSION,
  reviewSummaryClaimsSchema,
  reviewSummaryResponseSchema,
} from "@/contracts/review-summaries";
import { idSchema, profileIdSchema } from "@/contracts/journal";
import { isoTimestamp } from "./journal-serialization";
import {
  ApiError,
  assertSameOrigin,
  handleApi,
  json,
  parseInput,
} from "./api-errors";
import type { ReviewSummaryModelAdapter } from "./review-summary-model";
import type {
  ReviewSummaryKey,
  ReviewSummaryRepository,
} from "./review-summary-repository";

export function reviewSourceFingerprint(
  reviews: Awaited<ReturnType<ReviewSummaryRepository["source"]>>["reviews"],
) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        reviews.map(({ id, profileId, visitDate, createdAt, reviewText }) => ({
          id,
          profileId,
          visitDate,
          createdAt,
          reviewText,
        })),
      ),
    )
    .digest("hex");
}

type Dependencies = {
  repository: () => ReviewSummaryRepository;
  selectedProfile: () => Promise<string | undefined>;
  model: () => ReviewSummaryModelAdapter | null;
  reportError: (error: unknown) => void;
};

export function createReviewSummaryApi(deps: Dependencies) {
  const handle = (work: () => Promise<Response>) =>
    handleApi(work, deps.reportError);

  return {
    generate: (request: Request, restaurantId: string) =>
      handle(async () => {
        assertSameOrigin(request);
        const selected = profileIdSchema.safeParse(
          await deps.selectedProfile(),
        );
        if (!selected.success)
          throw new ApiError(
            401,
            "PROFILE_REQUIRED",
            "Select a predefined journal profile first.",
          );
        const validId = parseInput(idSchema, restaurantId, "INVALID_ID");
        const repository = deps.repository();
        const source = await repository.source(validId);
        if (!source.exists)
          throw new ApiError(
            404,
            "NOT_FOUND",
            "The saved restaurant could not be found.",
          );
        const reviews = source.reviews;
        const profileCount = new Set(reviews.map((review) => review.profileId))
          .size;
        if (reviews.length < 3 || profileCount < 2)
          return json(
            reviewSummaryResponseSchema.parse({
              data: {
                status: "insufficient-reviews",
                restaurantId: validId,
                sourceReviewCount: reviews.length,
                profileCount,
                requiredReviewCount: 3,
                requiredProfileCount: 2,
              },
            }),
          );
        const model = deps.model();
        if (!model)
          throw new ApiError(
            503,
            "SUMMARY_MODEL_UNCONFIGURED",
            "Review summaries are unavailable until a server-side model and credential are configured.",
          );
        if (model.promptVersion !== REVIEW_SUMMARY_PROMPT_VERSION)
          throw new ApiError(
            503,
            "SUMMARY_MODEL_UNCONFIGURED",
            "The configured summary model adapter uses an unsupported prompt version.",
          );
        const key: ReviewSummaryKey = {
          restaurantId: validId,
          sourceFingerprint: reviewSourceFingerprint(reviews),
          model: model.model,
          promptVersion: model.promptVersion,
        };
        const sourceReviewIds = reviews.map((review) => review.id);
        const matchesCurrentSource = async () => {
          const fresh = await repository.source(validId);
          return (
            fresh.exists &&
            fresh.reviews.length >= 3 &&
            new Set(fresh.reviews.map((review) => review.profileId)).size >=
              2 &&
            reviewSourceFingerprint(fresh.reviews) === key.sourceFingerprint
          );
        };
        const ready = async (
          row: NonNullable<Awaited<ReturnType<typeof repository.get>>>,
          cached: boolean,
        ) => {
          if (
            row.status !== "completed" ||
            !row.claims ||
            row.generatedAt === null ||
            row.sourceReviewIds.length !== sourceReviewIds.length ||
            row.sourceReviewIds.some(
              (id, index) => id !== sourceReviewIds[index],
            ) ||
            !(await matchesCurrentSource())
          )
            throw new ApiError(
              409,
              "SUMMARY_SOURCE_CHANGED",
              "Reviews changed during summary generation. Request a fresh summary.",
            );
          const claims = reviewSummaryClaimsSchema.safeParse(row.claims);
          const allowed = new Set(sourceReviewIds);
          if (
            !claims.success ||
            claims.data.claims.some((claim) =>
              claim.supportingReviewIds.some((id) => !allowed.has(id)),
            )
          )
            throw new ApiError(
              502,
              "SUMMARY_INVALID_OUTPUT",
              "The model summary failed citation validation and was not returned.",
            );
          return json(
            reviewSummaryResponseSchema.parse({
              data: {
                status: "ready",
                restaurantId: validId,
                sourceFingerprint: key.sourceFingerprint,
                model: key.model,
                promptVersion: key.promptVersion,
                sourceReviewCount: sourceReviewIds.length,
                profileCount,
                sourceReviewIds,
                claims: claims.data.claims,
                generatedAt: isoTimestamp(row.generatedAt),
                cached,
              },
            }),
          );
        };

        const cached = await repository.get(key);
        if (cached?.status === "completed") return ready(cached, true);
        const claim = await repository.claim(key, sourceReviewIds);
        if (!claim.owner)
          return json(
            reviewSummaryResponseSchema.parse({
              data: {
                status: "generating",
                restaurantId: validId,
                retryAfterSeconds: 2,
              },
            }),
            202,
            { "Retry-After": "2" },
          );

        try {
          const generated = await model.summarize(
            reviews.map(({ id, reviewText }) => ({ id, reviewText })),
          );
          const claims = reviewSummaryClaimsSchema.safeParse(generated);
          const allowed = new Set(sourceReviewIds);
          if (
            !claims.success ||
            claims.data.claims.some((claim) =>
              claim.supportingReviewIds.some((id) => !allowed.has(id)),
            )
          )
            throw new ApiError(
              502,
              "SUMMARY_INVALID_OUTPUT",
              "The model summary failed citation validation and was not returned.",
            );
          if (!(await matchesCurrentSource()))
            throw new ApiError(
              409,
              "SUMMARY_SOURCE_CHANGED",
              "Reviews changed during summary generation. Request a fresh summary.",
            );
          if (!(await repository.complete(claim.id, claims.data)))
            throw new ApiError(
              409,
              "SUMMARY_SOURCE_CHANGED",
              "Reviews changed during summary generation. Request a fresh summary.",
            );
          const completed = await repository.get(key);
          if (!completed)
            throw new ApiError(
              409,
              "SUMMARY_SOURCE_CHANGED",
              "Reviews changed during summary generation. Request a fresh summary.",
            );
          return ready(completed, false);
        } catch (error) {
          await repository.fail(claim.id);
          if (error instanceof ApiError) throw error;
          if (error && typeof error === "object" && "failure" in error) {
            const timedOut = error.failure === "timeout";
            throw new ApiError(
              timedOut ? 504 : 502,
              timedOut ? "SUMMARY_MODEL_TIMEOUT" : "SUMMARY_MODEL_UNAVAILABLE",
              timedOut
                ? "The review summary model timed out after bounded retries."
                : "The review summary model could not complete the request after bounded retries.",
            );
          }
          throw new ApiError(
            502,
            "SUMMARY_MODEL_UNAVAILABLE",
            "The review summary model could not complete the request.",
          );
        }
      }),
  };
}
