import { z } from "zod";
import {
  idSchema,
  profileIdSchema,
  restaurantWithSummarySchema,
  paginationSchema,
} from "./journal";

export const RECOMMENDATION_VERSION = "recommendations-v1";
const decimal = z.string().regex(/^\d+(?:\.\d+)?$/);
export const recommendationFiltersSchema = z.strictObject({
  cuisine: z.string().trim().min(1).max(60).nullable().default(null),
  kind: z.enum(["restaurant", "cafe"]).nullable().default(null),
  maxPriceTier: z.number().int().min(1).max(4).nullable().default(null),
  maxDistanceMeters: z.number().min(0).max(20_000_000).nullable().default(null),
  openNowOnly: z.boolean().default(false),
});
export const recommendationCreateSchema = z
  .strictObject({
    requestId: idSchema,
    mode: z.enum(["favorites", "new"]),
    attendees: z
      .array(profileIdSchema)
      .min(1)
      .max(5)
      .refine(
        (items) => new Set(items).size === items.length,
        "Attendees must be unique.",
      ),
    filters: recommendationFiltersSchema.default({
      cuisine: null,
      kind: null,
      maxPriceTier: null,
      maxDistanceMeters: null,
      openNowOnly: false,
    }),
    query: z.string().trim().max(160).default(""),
    limit: z.number().int().min(1).max(20).default(10),
  })
  .refine((value) => value.mode === "new" || value.query === "", {
    path: ["query"],
    message: "Search query applies only to Something New.",
  });
export const recommendationListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const selectionFeedbackSchema = z.strictObject({
  resultId: idSchema,
  choice: z.enum(["selected", "dismissed"]),
});
export const confirmedVisitSchema = z.strictObject({
  resultId: idSchema,
  visitId: idSchema,
});

export const recommendationMetricsSchema = z.object({
  coverage: decimal,
  observedMean: decimal.nullable(),
  disagreement: decimal.nullable(),
  cuisineAffinity: decimal.nullable(),
  ratedAttendeeCount: z.number().int().min(0).max(5),
  preferenceAttendeeCount: z.number().int().min(0).max(5),
  coldStartAttendeeCount: z.number().int().min(0).max(5),
  metadataKnownCount: z.number().int().min(0).max(4),
});
export const explanationSchema = z.object({
  code: z.enum([
    "observed-ratings",
    "limited-agreement",
    "cuisine-preferences",
    "neutral-prior",
    "cold-start",
  ]),
  message: z.string().max(400),
});
export const scoringResultSchema = z.object({
  candidateKey: z.string().min(1).max(1000),
  rank: z.number().int().min(1).max(20),
  preferenceScore: decimal.refine(
    (value) => Number(value) >= 0 && Number(value) <= 100,
  ),
  metrics: recommendationMetricsSchema,
  explanations: z.array(explanationSchema).max(5),
});
export const scoringResponseSchema = z.object({
  data: z.object({
    algorithmVersion: z.literal(RECOMMENDATION_VERSION),
    scoreKind: z.literal("preference-index"),
    results: z.array(scoringResultSchema).max(20),
    counts: z.object({
      candidateCount: z.number().int().nonnegative(),
      eligibleCount: z.number().int().nonnegative(),
      rankedCount: z.number().int().nonnegative(),
      excludedCount: z.number().int().nonnegative(),
      rejectionReasons: z.record(z.string(), z.number().int().nonnegative()),
    }),
  }),
});

export type ScoringCandidate = {
  key: string;
  restaurantId: string | null;
  provider: string | null;
  providerPlaceId: string | null;
  normalizedKey: string;
  kind: "restaurant" | "cafe";
  cuisines: string[];
  priceTier: number | null;
  distanceMeters: number | null;
  openNow: boolean | null;
};
export type ScoringInput = {
  mode: "favorites" | "new";
  attendees: string[];
  ratings: { restaurantId: string; profileId: string; rating: string }[];
  places: { restaurantId: string; cuisines: string[] }[];
  candidates: ScoringCandidate[];
  excluded: {
    restaurantIds: string[];
    providerKeys: string[];
    normalizedKeys: string[];
  };
  filters: RecommendationFilters;
  limit: number;
};
export const discoveryCandidateSchema = z.object({
  provider: z.string().min(1).max(80),
  providerPlaceId: z.string().min(1).max(300),
  name: z.string().min(1).max(160),
  address: z.string().min(1).max(300),
  kind: z.enum(["restaurant", "cafe"]),
  cuisines: z.array(z.string().min(1).max(60)).max(8),
  priceTier: z.number().int().min(1).max(4).nullable(),
  distanceMeters: z.number().min(0).max(20_000_000).nullable(),
  openNow: z.boolean().nullable(),
  attribution: z.object({ text: z.string().min(1).max(1000), url: z.url() }),
});
const timestamp = z.iso.datetime({ offset: true });
export const resultDisplaySchema = z.union([
  z.object({
    status: z.literal("available"),
    source: z.literal("journal"),
    restaurant: restaurantWithSummarySchema,
  }),
  z.object({
    status: z.literal("available"),
    source: z.literal("provider"),
    candidate: discoveryCandidateSchema,
  }),
  z.object({ status: z.literal("unavailable"), reason: z.string() }),
]);
export const recommendationResultSchema = scoringResultSchema
  .omit({ candidateKey: true })
  .extend({
    id: idSchema,
    restaurantId: idSchema.nullable(),
    provider: z.string().nullable(),
    providerPlaceId: z.string().nullable(),
    display: resultDisplaySchema,
  });
export const recommendationRunSchema = z.object({
  id: idSchema,
  requestId: idSchema,
  mode: z.enum(["favorites", "new"]),
  status: z.enum(["pending", "completed", "empty", "unavailable", "failed"]),
  reason: z.string().nullable(),
  createdBy: z.string(),
  algorithmVersion: z.literal(RECOMMENDATION_VERSION),
  scoreKind: z.literal("preference-index"),
  scoreRange: z.object({ min: z.literal(0), max: z.literal(100) }),
  attendees: z.array(z.string()),
  filters: recommendationFiltersSchema,
  query: z.string(),
  limit: z.number().int(),
  counts: scoringResponseSchema.shape.data.shape.counts.nullable(),
  createdAt: timestamp,
  completedAt: timestamp.nullable(),
  results: z.array(recommendationResultSchema),
  feedback: z.array(
    z.object({
      profileId: z.string(),
      resultId: idSchema,
      choice: z.enum(["selected", "dismissed"]),
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  ),
  confirmedVisits: z.array(
    z.object({
      id: idSchema,
      profileId: z.string(),
      resultId: idSchema,
      visitId: idSchema,
      createdAt: timestamp,
    }),
  ),
});
export const recommendationResponseSchema = z.object({
  data: recommendationRunSchema,
});
export const recommendationListResponseSchema = z.object({
  data: z.array(
    recommendationRunSchema
      .pick({
        id: true,
        mode: true,
        status: true,
        reason: true,
        createdBy: true,
        createdAt: true,
        attendees: true,
      })
      .extend({ resultCount: z.number().int().nonnegative() }),
  ),
  pagination: paginationSchema,
});
const projectionMeta = recommendationRunSchema
  .pick({
    status: true,
    scoreKind: true,
    scoreRange: true,
    algorithmVersion: true,
  })
  .extend({ runId: idSchema });
export const recommendationProjectionSchemas = {
  attendees: z.object({
    data: recommendationRunSchema.shape.attendees,
    meta: projectionMeta,
  }),
  results: z.object({
    data: recommendationRunSchema.shape.results,
    meta: projectionMeta,
  }),
  feedback: z.object({
    data: recommendationRunSchema.shape.feedback,
    meta: projectionMeta,
  }),
  confirmedVisits: z.object({
    data: recommendationRunSchema.shape.confirmedVisits,
    meta: projectionMeta,
  }),
};

export type RecommendationCreate = z.infer<typeof recommendationCreateSchema>;
export type RecommendationFilters = z.infer<typeof recommendationFiltersSchema>;
export type RecommendationMetrics = z.infer<typeof recommendationMetricsSchema>;
export type RecommendationExplanation = z.infer<typeof explanationSchema>;
export type ScoredRecommendations = z.infer<
  typeof scoringResponseSchema
>["data"];
export type DiscoveryCandidate = z.infer<typeof discoveryCandidateSchema>;
export type RecommendationRun = z.infer<typeof recommendationRunSchema>;
