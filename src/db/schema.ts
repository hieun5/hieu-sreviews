import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  jsonb,
  primaryKey,
  foreignKey,
} from "drizzle-orm/pg-core";
import type {
  RecommendationFilters,
  RecommendationMetrics,
  RecommendationExplanation,
  ScoredRecommendations,
} from "@/contracts/recommendations";
import type { ReviewSummaryClaims } from "@/contracts/review-summaries";

export const profiles = pgTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    initials: text("initials").notNull(),
    avatar: text("avatar").notNull(),
  },
  (table) => [
    check("profile_name_nonempty", sql`length(trim(${table.name})) > 0`),
  ],
);

export const restaurants = pgTable(
  "restaurants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    kind: text("kind").notNull().default("restaurant"),
    cuisines: text("cuisines")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    priceTier: integer("price_tier"),
    normalizedName: text("normalized_name").notNull(),
    normalizedAddress: text("normalized_address").notNull(),
    provider: text("provider"),
    providerPlaceId: text("provider_place_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "restaurant_name_length",
      sql`length(trim(${table.name})) between 1 and 160`,
    ),
    check(
      "restaurant_address_length",
      sql`length(trim(${table.address})) between 1 and 300`,
    ),
    check("restaurant_kind", sql`${table.kind} in ('restaurant', 'cafe')`),
    check("restaurant_price_tier", sql`${table.priceTier} between 1 and 4`),
    check(
      "restaurant_provider_pair",
      sql`(${table.provider} is null) = (${table.providerPlaceId} is null)`,
    ),
    uniqueIndex("restaurant_provider_identity").on(
      table.provider,
      table.providerPlaceId,
    ),
    index("restaurant_manual_duplicate_lookup").on(
      table.normalizedName,
      table.normalizedAddress,
    ),
    index("restaurant_cuisines").using("gin", table.cuisines),
  ],
);

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "restrict" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    rating: numeric("rating").notNull(),
    visitDate: date("visit_date", { mode: "string" }).notNull(),
    reviewText: text("review_text"),
    orderDescription: text("order_description"),
    amountSpent: numeric("amount_spent", { precision: 12, scale: 2 }),
    currency: text("currency").default("USD").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "visit_rating_range",
      sql`${table.rating} >= 1 and ${table.rating} <= 10`,
    ),
    check("visit_review_length", sql`char_length(${table.reviewText}) <= 2000`),
    check(
      "visit_order_length",
      sql`char_length(${table.orderDescription}) <= 300`,
    ),
    check(
      "visit_spending_nonnegative",
      sql`${table.amountSpent} >= 0 and ${table.amountSpent} <= 9999999999.99`,
    ),
    check("visit_currency", sql`${table.currency} = 'USD'`),
    // The app additionally checks today's date in APP_TIME_ZONE.
    check(
      "visit_not_future_utc",
      sql`${table.visitDate} <= (now() at time zone 'UTC')::date`,
    ),
    index("visit_current_rating_lookup").on(
      table.restaurantId,
      table.profileId,
      table.visitDate.desc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("visit_profile_history").on(table.profileId, table.visitDate.desc()),
    index("visit_date_lookup").on(table.visitDate.desc()),
  ],
);

export type Restaurant = typeof restaurants.$inferSelect;
export type Visit = typeof visits.$inferSelect;

export const restaurantReviewSummaries = pgTable(
  "restaurant_review_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    sourceFingerprint: text("source_fingerprint").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    status: text("status").notNull().default("pending"),
    sourceReviewIds: jsonb("source_review_ids").$type<string[]>().notNull(),
    claims: jsonb("claims").$type<ReviewSummaryClaims>(),
    attempts: integer("attempts").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    generatedAt: timestamp("generated_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    uniqueIndex("restaurant_review_summary_cache_key").on(
      table.restaurantId,
      table.sourceFingerprint,
      table.model,
      table.promptVersion,
    ),
    index("restaurant_review_summary_status").on(table.status, table.updatedAt),
    check(
      "restaurant_review_summary_fingerprint",
      sql`${table.sourceFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "restaurant_review_summary_model_prompt",
      sql`length(trim(${table.model})) > 0 and length(trim(${table.promptVersion})) > 0`,
    ),
    check(
      "restaurant_review_summary_status_value",
      sql`${table.status} in ('pending', 'completed', 'failed')`,
    ),
    check(
      "restaurant_review_summary_completion",
      sql`(${table.status} = 'completed') = (${table.claims} is not null and ${table.generatedAt} is not null)`,
    ),
    check(
      "restaurant_review_summary_sources",
      sql`jsonb_typeof(${table.sourceReviewIds}) = 'array' and jsonb_array_length(${table.sourceReviewIds}) between 3 and 30`,
    ),
    check("restaurant_review_summary_attempts", sql`${table.attempts} > 0`),
  ],
);

export const recommendationRuns = pgTable(
  "recommendation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id").notNull(),
    requestHash: text("request_hash").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => profiles.id),
    mode: text("mode").notNull(),
    status: text("status").notNull().default("pending"),
    reason: text("reason"),
    algorithmVersion: text("algorithm_version").notNull(),
    filters: jsonb("filters").$type<RecommendationFilters>().notNull(),
    searchQuery: text("search_query").notNull().default(""),
    resultLimit: integer("result_limit").notNull(),
    counts: jsonb("counts").$type<ScoredRecommendations["counts"]>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    uniqueIndex("recommendation_request_identity").on(table.requestId),
    index("recommendation_runs_history").on(
      table.createdAt.desc(),
      table.id.desc(),
    ),
    check("recommendation_mode", sql`${table.mode} in ('favorites', 'new')`),
    check(
      "recommendation_status",
      sql`${table.status} in ('pending','completed','empty','unavailable','failed')`,
    ),
    check("recommendation_limit", sql`${table.resultLimit} between 1 and 20`),
    check(
      "recommendation_request_hash",
      sql`${table.requestHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "recommendation_filters_object",
      sql`jsonb_typeof(${table.filters}) = 'object'`,
    ),
    check(
      "recommendation_completion",
      sql`(${table.status} = 'pending') = (${table.completedAt} is null)`,
    ),
    check(
      "recommendation_failure_reason",
      sql`${table.status} not in ('unavailable','failed') or (${table.reason} is not null and length(trim(${table.reason})) > 0)`,
    ),
  ],
);

export const recommendationAttendees = pgTable(
  "recommendation_attendees",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => recommendationRuns.id, { onDelete: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id),
  },
  (table) => [primaryKey({ columns: [table.runId, table.profileId] })],
);

export const recommendationResults = pgTable(
  "recommendation_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => recommendationRuns.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    restaurantId: uuid("restaurant_id").references(() => restaurants.id),
    provider: text("provider"),
    providerPlaceId: text("provider_place_id"),
    providerPolicyVersion: text("provider_policy_version"),
    preferenceScore: numeric("preference_score", {
      precision: 9,
      scale: 6,
    }).notNull(),
    metrics: jsonb("metrics").$type<RecommendationMetrics>().notNull(),
    explanations: jsonb("explanations")
      .$type<RecommendationExplanation[]>()
      .notNull(),
  },
  (table) => [
    uniqueIndex("recommendation_result_parent").on(table.runId, table.id),
    uniqueIndex("recommendation_result_rank").on(table.runId, table.rank),
    uniqueIndex("recommendation_result_restaurant").on(
      table.runId,
      table.restaurantId,
    ),
    uniqueIndex("recommendation_result_provider").on(
      table.runId,
      table.provider,
      table.providerPlaceId,
    ),
    check("recommendation_rank", sql`${table.rank} between 1 and 20`),
    check(
      "recommendation_preference_score",
      sql`${table.preferenceScore} between 0 and 100`,
    ),
    check(
      "recommendation_result_identity",
      sql`(${table.restaurantId} is not null and ${table.provider} is null and ${table.providerPlaceId} is null and ${table.providerPolicyVersion} is null) or (${table.restaurantId} is null and ${table.provider} is not null and ${table.providerPlaceId} is not null and ${table.providerPolicyVersion} is not null and length(trim(${table.provider})) > 0 and length(trim(${table.providerPlaceId})) > 0 and length(trim(${table.providerPolicyVersion})) > 0)`,
    ),
    check(
      "recommendation_result_metrics",
      sql`jsonb_typeof(${table.metrics}) = 'object' and jsonb_typeof(${table.explanations}) = 'array'`,
    ),
  ],
);

export const recommendationFeedback = pgTable(
  "recommendation_feedback",
  {
    runId: uuid("run_id").notNull(),
    profileId: text("profile_id").notNull(),
    resultId: uuid("result_id").notNull(),
    choice: text("choice").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.profileId] }),
    uniqueIndex("recommendation_feedback_link_identity").on(
      table.runId,
      table.profileId,
      table.resultId,
      table.choice,
    ),
    foreignKey({
      columns: [table.runId, table.profileId],
      foreignColumns: [
        recommendationAttendees.runId,
        recommendationAttendees.profileId,
      ],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.runId, table.resultId],
      foreignColumns: [recommendationResults.runId, recommendationResults.id],
    }).onDelete("cascade"),
    check(
      "recommendation_feedback_choice",
      sql`${table.choice} in ('selected', 'dismissed')`,
    ),
  ],
);

export const recommendationVisitLinks = pgTable(
  "recommendation_visit_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    profileId: text("profile_id").notNull(),
    resultId: uuid("result_id").notNull(),
    visitId: uuid("visit_id")
      .notNull()
      .references(() => visits.id, { onDelete: "cascade" }),
    feedbackChoice: text("feedback_choice").notNull().default("selected"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("recommendation_visit_origin").on(table.visitId),
    foreignKey({
      name: "recommendation_link_feedback_fk",
      columns: [
        table.runId,
        table.profileId,
        table.resultId,
        table.feedbackChoice,
      ],
      foreignColumns: [
        recommendationFeedback.runId,
        recommendationFeedback.profileId,
        recommendationFeedback.resultId,
        recommendationFeedback.choice,
      ],
    }).onDelete("cascade"),
    check(
      "recommendation_confirmed_selection",
      sql`${table.feedbackChoice} = 'selected'`,
    ),
  ],
);
