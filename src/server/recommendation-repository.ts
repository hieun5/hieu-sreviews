import { createHash, randomUUID } from "node:crypto";
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  RECOMMENDATION_VERSION,
  recommendationRunSchema,
  recommendationResultSchema,
  type RecommendationCreate,
  type ScoredRecommendations,
} from "@/contracts/recommendations";
import * as schema from "@/db/schema";
import { ApiError } from "./api-errors";

const { recommendationRuns: runs, profiles, restaurants, visits } = schema;
const rawRunSchema = recommendationRunSchema.omit({ results: true }).extend({
  results: z.array(
    recommendationResultSchema
      .omit({ display: true })
      .extend({ providerPolicyVersion: z.string().nullable() }),
  ),
});
const rows = <T extends z.ZodType>(item: T, result: unknown) =>
  z.object({ rows: z.array(item) }).parse(result).rows;
const instant = (expression: ReturnType<typeof sql>) =>
  sql`to_char(${expression} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

function runJson() {
  return sql`jsonb_build_object(
    'id', r.id, 'requestId', r.request_id, 'mode', r.mode, 'status', r.status, 'reason', r.reason, 'createdBy', r.created_by,
    'algorithmVersion', r.algorithm_version, 'scoreKind', 'preference-index', 'scoreRange', jsonb_build_object('min', 0, 'max', 100),
    'filters', r.filters, 'query', r.search_query, 'limit', r.result_limit, 'counts', r.counts,
    'createdAt', ${instant(sql`r.created_at`)}, 'completedAt', ${instant(sql`r.completed_at`)},
    'attendees', coalesce((select jsonb_agg(a.profile_id order by a.profile_id) from recommendation_attendees a where a.run_id = r.id), '[]'::jsonb),
    'results', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'rank', s.rank, 'restaurantId', s.restaurant_id, 'provider', s.provider,
      'providerPlaceId', s.provider_place_id, 'providerPolicyVersion', s.provider_policy_version, 'preferenceScore', s.preference_score::text,
      'metrics', s.metrics, 'explanations', s.explanations) order by s.rank) from recommendation_results s where s.run_id = r.id), '[]'::jsonb),
    'feedback', coalesce((select jsonb_agg(jsonb_build_object('profileId', f.profile_id, 'resultId', f.result_id, 'choice', f.choice,
      'createdAt', ${instant(sql`f.created_at`)}, 'updatedAt', ${instant(sql`f.updated_at`)}) order by f.profile_id) from recommendation_feedback f where f.run_id = r.id), '[]'::jsonb),
    'confirmedVisits', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'profileId', l.profile_id, 'resultId', l.result_id, 'visitId', l.visit_id,
      'createdAt', ${instant(sql`l.created_at`)}) order by l.created_at, l.id) from recommendation_visit_links l where l.run_id = r.id), '[]'::jsonb)
  )`;
}

function postgresCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  return "cause" in error && error.cause !== error
    ? postgresCode(error.cause)
    : undefined;
}

export type PersistedRanking = {
  restaurantId: string | null;
  provider: string | null;
  providerPlaceId: string | null;
  providerPolicyVersion: string | null;
} & ScoredRecommendations["results"][number];

export function createRecommendationRepository<Q extends PgQueryResultHKT>(
  db: PgDatabase<Q, typeof schema>,
) {
  async function expireInterrupted() {
    // A hard-stopped serverless worker cannot leave a run "generating" forever.
    // Reuse never re-scores changing journal/provider inputs under the same ID.
    await db
      .update(runs)
      .set({
        status: "failed",
        reason: "worker-interrupted",
        completedAt: sql`clock_timestamp()`,
      })
      .where(
        and(
          eq(runs.status, "pending"),
          sql`${runs.createdAt} < now() - interval '2 minutes'`,
        ),
      );
  }
  async function getRun(id: string) {
    await expireInterrupted();
    const result = await db.execute(
      sql`select ${runJson()} as run from recommendation_runs r where r.id = ${id}::uuid`,
    );
    const row = rows(z.object({ run: rawRunSchema }), result)[0];
    return row?.run ?? null;
  }

  async function context() {
    const [allProfiles, allRestaurants, allVisits] = await Promise.all([
      db.select().from(profiles),
      db.select().from(restaurants),
      db.select().from(visits),
    ]);
    return {
      profiles: allProfiles,
      restaurants: allRestaurants,
      visits: allVisits,
    };
  }

  async function claim(input: RecommendationCreate, creator: string) {
    // Fix key order as well as attendee order: equivalent requests must hash
    // alike even when a caller constructs its object in a different order.
    const canonical = {
      requestId: input.requestId,
      mode: input.mode,
      attendees: [...input.attendees].sort(),
      filters: {
        cuisine: input.filters.cuisine,
        kind: input.filters.kind,
        maxPriceTier: input.filters.maxPriceTier,
        maxDistanceMeters: input.filters.maxDistanceMeters,
        openNowOnly: input.filters.openNowOnly,
      },
      query: input.query,
      limit: input.limit,
    };
    const requestHash = createHash("sha256")
      .update(JSON.stringify(canonical))
      .digest("hex");
    const id = randomUUID();
    // Run and attendees are one statement: no partial group if insertion fails.
    const result = await db.execute(sql`
      with inserted as (
        insert into recommendation_runs(id, request_id, request_hash, created_by, mode, algorithm_version, filters, search_query, result_limit)
        values (${id}::uuid, ${input.requestId}::uuid, ${requestHash}, ${creator}, ${input.mode}, ${RECOMMENDATION_VERSION}, ${JSON.stringify(input.filters)}::jsonb, ${input.query}, ${input.limit})
        on conflict (request_id) do nothing returning id
      ), joined as (
        insert into recommendation_attendees(run_id, profile_id)
        select i.id, a.value from inserted i cross join jsonb_array_elements_text(${JSON.stringify(canonical.attendees)}::jsonb) a(value) returning profile_id
      ) select id, (select count(*)::int from joined) as attendees from inserted
    `);
    if (
      rows(z.object({ id: z.string(), attendees: z.number() }), result).length
    )
      return { id, created: true };
    const [existing] = await db
      .select()
      .from(runs)
      .where(eq(runs.requestId, input.requestId));
    if (
      !existing ||
      existing.createdBy !== creator ||
      existing.requestHash !== requestHash
    )
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This request ID belongs to a different recommendation request.",
      );
    return { id: existing.id, created: false };
  }

  async function finish(
    id: string,
    scored: ScoredRecommendations,
    ranking: PersistedRanking[],
  ) {
    const records = ranking.map((row) => ({
      id: randomUUID(),
      rank: row.rank,
      restaurant_id: row.restaurantId,
      provider: row.provider,
      provider_place_id: row.providerPlaceId,
      provider_policy_version: row.providerPolicyVersion,
      preference_score: row.preferenceScore,
      metrics: row.metrics,
      explanations: row.explanations,
    }));
    const result = await db.execute(sql`
      with locked as (
        update recommendation_runs set status = ${records.length ? "completed" : "empty"}, counts = ${JSON.stringify(scored.counts)}::jsonb,
          completed_at = clock_timestamp() where id = ${id}::uuid and status = 'pending' returning id
      ), stored as (
        insert into recommendation_results(id, run_id, rank, restaurant_id, provider, provider_place_id, provider_policy_version, preference_score, metrics, explanations)
        select s.id, l.id, s.rank, s.restaurant_id, s.provider, s.provider_place_id, s.provider_policy_version, s.preference_score, s.metrics, s.explanations
        from locked l cross join jsonb_to_recordset(${JSON.stringify(records)}::jsonb)
          as s(id uuid, rank int, restaurant_id uuid, provider text, provider_place_id text, provider_policy_version text, preference_score numeric, metrics jsonb, explanations jsonb)
        returning id
      ) select (select count(*)::int from locked) as finalized, (select count(*)::int from stored) as stored
    `);
    const record = rows(
      z.object({ finalized: z.number(), stored: z.number() }),
      result,
    )[0];
    if (record.finalized !== 1 || record.stored !== records.length)
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "The recommendation run has already been finalized.",
      );
  }

  async function markState(
    id: string,
    status: "unavailable" | "failed",
    reason: string,
  ) {
    await db
      .update(runs)
      .set({ status, reason, completedAt: sql`clock_timestamp()` })
      .where(and(eq(runs.id, id), eq(runs.status, "pending")));
  }

  async function list(page: number, pageSize: number) {
    await expireInterrupted();
    // Keep outer qualification inside correlated subqueries: Drizzle's
    // single-table selection otherwise unqualifies a Column interpolation.
    const outerId = sql`${sql.identifier("recommendation_runs")}.${sql.identifier("id")}`;
    const [data, total] = await Promise.all([
      db
        .select({
          id: runs.id,
          mode: runs.mode,
          status: runs.status,
          reason: runs.reason,
          createdBy: runs.createdBy,
          createdAt: runs.createdAt,
          resultCount: sql<number>`(select count(*)::int from recommendation_results s where s.run_id = ${outerId})`,
          attendees: sql<
            string[]
          >`array(select a.profile_id from recommendation_attendees a where a.run_id = ${outerId} order by a.profile_id)`,
        })
        .from(runs)
        .orderBy(desc(runs.createdAt), desc(runs.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: count() }).from(runs),
    ]);
    return {
      data,
      pagination: {
        page,
        pageSize,
        total: total[0].total,
        hasNextPage: page * pageSize < total[0].total,
      },
    };
  }

  async function checkAttendee(
    runId: string,
    profileId: string,
    resultId: string,
  ) {
    const run = await getRun(runId);
    if (!run)
      throw new ApiError(
        404,
        "NOT_FOUND",
        "The recommendation run could not be found.",
      );
    if (!run.attendees.includes(profileId))
      throw new ApiError(
        403,
        "NOT_ATTENDING",
        "Select an attendee's profile to record feedback for that person.",
      );
    if (!run.results.some((row) => row.id === resultId))
      throw new ApiError(
        404,
        "NOT_FOUND",
        "This ranked result does not belong to the run.",
      );
    if (run.status !== "completed")
      throw new ApiError(
        409,
        "FEEDBACK_LOCKED",
        "This run has no completed ranking.",
      );
    return run;
  }

  async function feedback(
    runId: string,
    resultId: string,
    profileId: string,
    choice: "selected" | "dismissed",
  ) {
    await checkAttendee(runId, profileId, resultId);
    try {
      const result = await db.execute(sql`
        insert into recommendation_feedback(run_id, profile_id, result_id, choice)
        select ${runId}::uuid, ${profileId}, ${resultId}::uuid, ${choice}
        where not exists(select 1 from recommendation_visit_links where run_id = ${runId}::uuid and profile_id = ${profileId})
        on conflict (run_id, profile_id) do update set result_id = excluded.result_id, choice = excluded.choice, updated_at = clock_timestamp()
        where not exists(select 1 from recommendation_visit_links where run_id = ${runId}::uuid and profile_id = ${profileId}) returning run_id
      `);
      if (!rows(z.object({ run_id: z.string() }), result).length)
        throw new ApiError(
          409,
          "FEEDBACK_LOCKED",
          "Confirmed visit feedback cannot be changed.",
        );
    } catch (error) {
      if (postgresCode(error) === "23503")
        throw new ApiError(
          409,
          "FEEDBACK_LOCKED",
          "Confirmed visit feedback cannot be changed.",
        );
      throw error;
    }
  }

  async function confirmVisit(
    runId: string,
    resultId: string,
    profileId: string,
    visitId: string,
    earliestDate: string,
  ) {
    await checkAttendee(runId, profileId, resultId);
    try {
      const result = await db.execute(sql`
        insert into recommendation_visit_links(run_id, result_id, profile_id, visit_id)
        select r.id, s.id, ${profileId}, v.id from recommendation_runs r
        join recommendation_results s on s.run_id = r.id
        join recommendation_feedback f on f.run_id = r.id and f.result_id = s.id and f.profile_id = ${profileId} and f.choice = 'selected'
        join visits v on v.id = ${visitId}::uuid and v.profile_id = ${profileId} and v.created_at >= r.created_at and v.visit_date >= ${earliestDate}::date
        join restaurants p on p.id = v.restaurant_id
        where r.id = ${runId}::uuid and r.status = 'completed' and s.id = ${resultId}::uuid
          and (s.restaurant_id = p.id or (s.provider = p.provider and s.provider_place_id = p.provider_place_id))
        for update of v
        on conflict (visit_id) do nothing returning id
      `);
      if (rows(z.object({ id: z.string() }), result).length) return;
      const [existing] = await db
        .select()
        .from(schema.recommendationVisitLinks)
        .where(eq(schema.recommendationVisitLinks.visitId, visitId));
      if (
        existing?.runId === runId &&
        existing.resultId === resultId &&
        existing.profileId === profileId
      )
        return;
    } catch (error) {
      if (postgresCode(error) !== "23503") throw error;
    }
    throw new ApiError(
      409,
      "INVALID_VISIT_LINK",
      "Link a matching visit recorded by the selected attendee after this run, following that attendee's selection.",
    );
  }

  return {
    context,
    claim,
    finish,
    markState,
    getRun,
    list,
    feedback,
    confirmVisit,
  };
}

export type RecommendationRepository = ReturnType<
  typeof createRecommendationRepository
>;
