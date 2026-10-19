import { z } from "zod";
import {
  calendarDateSchema,
  idSchema,
  restaurantSchema,
  visitSchema,
} from "./journal";

const filterFields = {
  view: z.enum(["personal", "group"]).default("group"),
  profileId: z.string().trim().min(1).max(100).optional(),
  restaurantId: idSchema.optional(),
  cuisine: z.string().trim().min(1).max(60).optional(),
  start: calendarDateSchema.optional(),
  end: calendarDateSchema.optional(),
};
const validRange = (value: { start?: string; end?: string }) =>
  !value.start || !value.end || value.start <= value.end;
const validProfile = (value: { view: string; profileId?: string }) =>
  value.view === "personal" || value.profileId === undefined;
export const analyticsQuerySchema = z
  .strictObject(filterFields)
  .refine(validRange, {
    path: ["end"],
    message: "Start date must be on or before end date.",
  })
  .refine(validProfile, {
    path: ["profileId"],
    message: "Use view=personal when filtering by a profile.",
  });
export const dashboardQuerySchema = z
  .strictObject({
    ...filterFields,
    recentLimit: z.coerce.number().int().min(1).max(50).default(6),
  })
  .refine(validRange, {
    path: ["end"],
    message: "Start date must be on or before end date.",
  })
  .refine(validProfile, {
    path: ["profileId"],
    message: "Use view=personal when filtering by a profile.",
  });

const count = z.number().int().nonnegative();
const decimal = z.string().regex(/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i);
export const reportCountsSchema = z.object({
  savedRestaurantCount: count,
  visitedRestaurantCount: count,
  historicalVisitCount: count,
  historicalReviewerCount: count,
  currentScoreCount: count,
  currentReviewerCount: count,
  currentlyRatedRestaurantCount: count,
  personalVisitCount: count,
  personalVisitedRestaurantCount: count,
});

export const reportSemantics = {
  currentRatings: "latest-on-or-before-end-then-apply-start",
  latestOrder: "visit-date-desc,creation-instant-desc,stable-id-desc",
  history: "all-visits-in-inclusive-date-range",
  currentAverage: "one-current-score-per-profile-and-restaurant",
  agreement: "population-standard-deviation-needs-two-current-scores",
  personalPlaces:
    "latest-personal-visit-per-restaurant-as-of-end-then-apply-start",
  cuisine:
    "distinct-restaurant-tag-memberships;places-can-contribute-to-multiple-tags",
  recommendationActivity:
    "feedback-by-run-created-local-day;linked-visits-by-filtered-visit-date",
} as const;

const profileReference = z.object({
  id: z.string().min(1),
  name: z.string(),
  initials: z.string(),
  avatar: z.string(),
});
export const filterOptionsSchema = z.object({
  profiles: z.array(profileReference),
  restaurants: z.array(z.object({ id: idSchema, name: z.string() })),
  cuisines: z.array(z.string()),
});
export const reportMetaSchema = z.object({
  filters: z.object({
    view: z.enum(["personal", "group"]),
    profileId: z.string().nullable(),
    restaurantId: idSchema.nullable(),
    cuisine: z.string().nullable(),
    start: calendarDateSchema.nullable(),
    end: calendarDateSchema.nullable(),
  }),
  selectedProfileId: z.string(),
  personalProfileId: z.string(),
  timeZone: z.string(),
  today: calendarDateSchema,
  semantics: z.object({
    currentRatings: z.literal(reportSemantics.currentRatings),
    latestOrder: z.literal(reportSemantics.latestOrder),
    history: z.literal(reportSemantics.history),
    currentAverage: z.literal(reportSemantics.currentAverage),
    agreement: z.literal(reportSemantics.agreement),
    personalPlaces: z.literal(reportSemantics.personalPlaces),
    cuisine: z.literal(reportSemantics.cuisine),
    recommendationActivity: z.literal(reportSemantics.recommendationActivity),
  }),
});

const summaryFields = {
  counts: reportCountsSchema,
  currentAverage: decimal.nullable(),
  filterOptions: filterOptionsSchema,
};
const recentVisit = visitSchema.extend({
  restaurant: restaurantSchema,
  profile: profileReference,
});
const recentPlace = z.object({
  restaurant: restaurantSchema,
  latestVisit: visitSchema,
  currentRating: z.object({
    average: decimal.nullable(),
    agreement: decimal.nullable(),
    reviewerCount: count,
    visitCount: count,
  }),
});
const recentPage = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    limit: count,
    total: count,
    hasMore: z.boolean(),
  });
export const dashboardPayloadSchema = z.object({
  ...summaryFields,
  recentVisits: recentPage(recentVisit),
  recentlyReviewedPlaces: recentPage(recentPlace),
});
export const dashboardResponseSchema = z.object({
  data: dashboardPayloadSchema.extend({ meta: reportMetaSchema }),
});

export const analyticsPayloadSchema = z.object({
  ...summaryFields,
  leaderboard: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      average: decimal,
      agreement: decimal.nullable(),
      reviewerCount: count,
      visitCount: count,
    }),
  ),
  timeline: z.array(
    z.object({
      date: calendarDateSchema,
      average: decimal.nullable(),
      visitCount: count,
      ratedVisitCount: count,
      reviewerCount: count,
      restaurantCount: count,
    }),
  ),
  comparison: z.array(
    z.object({
      profileId: z.string(),
      name: z.string(),
      average: decimal.nullable(),
      placeCount: count,
      visitCount: count,
    }),
  ),
  cuisines: z.array(
    z.object({
      name: z.string(),
      average: decimal.nullable(),
      scoreCount: count,
      reviewerCount: count,
      restaurantCount: count,
      visitCount: count,
    }),
  ),
  spending: z.object({
    currency: z.literal("USD"),
    recordedVisitCount: count,
    totalCents: count.nullable(),
    averageCents: count.nullable(),
    averageRounding: z.literal("nearest-cent-half-up"),
  }),
  recommendationActivity: z.object({
    selectedCount: count,
    dismissedCount: count,
    linkedSelectionCount: count,
    linkedVisitCount: count,
    linkedProfileCount: count,
    linkedSelectionRatePercent: decimal.nullable(),
  }),
});
export const analyticsResponseSchema = z.object({
  data: analyticsPayloadSchema.extend({ meta: reportMetaSchema }),
});

export type ReportQuery = z.infer<typeof analyticsQuerySchema>;
export type ReportMeta = z.infer<typeof reportMetaSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type AnalyticsResponse = z.infer<typeof analyticsResponseSchema>;
export type AnalyticsPayload = z.infer<typeof analyticsPayloadSchema>;
export type EffectiveReportFilters = ReportMeta["filters"];
