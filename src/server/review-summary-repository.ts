import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { ReviewSummaryClaims } from "@/contracts/review-summaries";
import * as schema from "@/db/schema";
import type { ReviewSummarySource } from "./review-summary-model";

export type ReviewSummaryKey = {
  restaurantId: string;
  sourceFingerprint: string;
  model: string;
  promptVersion: string;
};

export function createReviewSummaryRepository<Q extends PgQueryResultHKT>(
  db: PgDatabase<Q, typeof schema>,
) {
  async function source(restaurantId: string) {
    const [restaurant] = await db
      .select({ id: schema.restaurants.id })
      .from(schema.restaurants)
      .where(eq(schema.restaurants.id, restaurantId));
    if (!restaurant)
      return { exists: false as const, reviews: [] as ReviewSummarySource[] };
    const reviews = await db
      .select({
        id: schema.visits.id,
        profileId: schema.visits.profileId,
        reviewText: schema.visits.reviewText,
        visitDate: schema.visits.visitDate,
        createdAt: schema.visits.createdAt,
      })
      .from(schema.visits)
      .where(
        and(
          eq(schema.visits.restaurantId, restaurantId),
          isNotNull(schema.visits.reviewText),
          sql`btrim(${schema.visits.reviewText}) <> ''`,
        ),
      )
      .orderBy(
        desc(schema.visits.visitDate),
        desc(schema.visits.createdAt),
        desc(schema.visits.id),
      )
      .limit(30);
    return {
      exists: true as const,
      reviews: reviews as ReviewSummarySource[],
    };
  }

  async function get(key: ReviewSummaryKey) {
    const [row] = await db
      .select()
      .from(schema.restaurantReviewSummaries)
      .where(
        and(
          eq(schema.restaurantReviewSummaries.restaurantId, key.restaurantId),
          eq(
            schema.restaurantReviewSummaries.sourceFingerprint,
            key.sourceFingerprint,
          ),
          eq(schema.restaurantReviewSummaries.model, key.model),
          eq(schema.restaurantReviewSummaries.promptVersion, key.promptVersion),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async function claim(key: ReviewSummaryKey, sourceReviewIds: string[]) {
    // Timed-out serverless workers cannot leave a reservation blocking this key forever.
    await db
      .update(schema.restaurantReviewSummaries)
      .set({ status: "failed", updatedAt: sql`clock_timestamp()` })
      .where(
        and(
          eq(schema.restaurantReviewSummaries.restaurantId, key.restaurantId),
          eq(
            schema.restaurantReviewSummaries.sourceFingerprint,
            key.sourceFingerprint,
          ),
          eq(schema.restaurantReviewSummaries.model, key.model),
          eq(schema.restaurantReviewSummaries.promptVersion, key.promptVersion),
          eq(schema.restaurantReviewSummaries.status, "pending"),
          sql`${schema.restaurantReviewSummaries.updatedAt} < clock_timestamp() - interval '60 seconds'`,
        ),
      );
    const [inserted] = await db
      .insert(schema.restaurantReviewSummaries)
      .values({ ...key, sourceReviewIds, status: "pending" })
      .onConflictDoNothing({
        target: [
          schema.restaurantReviewSummaries.restaurantId,
          schema.restaurantReviewSummaries.sourceFingerprint,
          schema.restaurantReviewSummaries.model,
          schema.restaurantReviewSummaries.promptVersion,
        ],
      })
      .returning({ id: schema.restaurantReviewSummaries.id });
    if (inserted) return { id: inserted.id, owner: true };
    const [retried] = await db
      .update(schema.restaurantReviewSummaries)
      .set({
        status: "pending",
        attempts: sql`${schema.restaurantReviewSummaries.attempts} + 1`,
        sourceReviewIds,
        claims: null,
        generatedAt: null,
        updatedAt: sql`clock_timestamp()`,
      })
      .where(
        and(
          eq(schema.restaurantReviewSummaries.restaurantId, key.restaurantId),
          eq(
            schema.restaurantReviewSummaries.sourceFingerprint,
            key.sourceFingerprint,
          ),
          eq(schema.restaurantReviewSummaries.model, key.model),
          eq(schema.restaurantReviewSummaries.promptVersion, key.promptVersion),
          eq(schema.restaurantReviewSummaries.status, "failed"),
        ),
      )
      .returning({ id: schema.restaurantReviewSummaries.id });
    if (retried) return { id: retried.id, owner: true };
    const existing = await get(key);
    if (!existing) throw new Error("Summary reservation disappeared.");
    return { id: existing.id, owner: false };
  }

  async function complete(id: string, claims: ReviewSummaryClaims) {
    const [row] = await db
      .update(schema.restaurantReviewSummaries)
      .set({
        status: "completed",
        claims,
        generatedAt: sql`clock_timestamp()`,
        updatedAt: sql`clock_timestamp()`,
      })
      .where(
        and(
          eq(schema.restaurantReviewSummaries.id, id),
          eq(schema.restaurantReviewSummaries.status, "pending"),
        ),
      )
      .returning({ id: schema.restaurantReviewSummaries.id });
    return Boolean(row);
  }

  async function fail(id: string) {
    await db
      .update(schema.restaurantReviewSummaries)
      .set({
        status: "failed",
        claims: null,
        generatedAt: null,
        updatedAt: sql`clock_timestamp()`,
      })
      .where(
        and(
          eq(schema.restaurantReviewSummaries.id, id),
          eq(schema.restaurantReviewSummaries.status, "pending"),
        ),
      );
  }

  return { source, get, claim, complete, fail };
}

export type ReviewSummaryRepository = ReturnType<
  typeof createReviewSummaryRepository
>;
