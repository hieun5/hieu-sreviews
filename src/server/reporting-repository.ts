import Decimal from "decimal.js";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  analyticsPayloadSchema,
  dashboardPayloadSchema,
  type EffectiveReportFilters,
} from "@/contracts/reporting";
import type * as schema from "@/db/schema";
import { ApiError } from "./api-errors";

function timestamp(expression: ReturnType<typeof sql>) {
  return sql`to_char(${expression} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}
function visitJson(alias: string) {
  const v = sql.identifier(alias);
  return sql`jsonb_build_object('id', ${v}.id, 'restaurantId', ${v}.restaurant_id, 'profileId', ${v}.profile_id,
    'rating', ${v}.rating::float8, 'visitDate', ${v}.visit_date::text, 'reviewText', ${v}.review_text, 'orderDescription', ${v}.order_description,
    'amountSpentCents', (${v}.amount_spent * 100)::bigint, 'currency', ${v}.currency,
    'createdAt', ${timestamp(sql`${v}.created_at`)}, 'updatedAt', ${timestamp(sql`${v}.updated_at`)})`;
}
function restaurantJson(alias: string) {
  const p = sql.identifier(alias);
  return sql`jsonb_build_object('id', ${p}.id, 'name', ${p}.name, 'address', ${p}.address, 'kind', ${p}.kind, 'cuisines', ${p}.cuisines,
    'priceTier', ${p}.price_tier, 'provider', ${p}.provider, 'providerPlaceId', ${p}.provider_place_id, 'createdAt', ${timestamp(sql`${p}.created_at`)})`;
}
function average(alias: string) {
  // Retain ample numeric scale for the existing decimal-rating contract; only
  // rating DTOs become JSON numbers, never aggregate arithmetic.
  return sql`avg(${sql.identifier(alias)}.rating::numeric(100,80))::text`;
}

function sharedCtes(
  filters: EffectiveReportFilters,
  personalProfileId: string,
) {
  const end = (alias: string) =>
    filters.end
      ? sql`${sql.identifier(alias)}.visit_date <= ${filters.end}::date`
      : sql`true`;
  const start = (alias: string) =>
    filters.start
      ? sql`${sql.identifier(alias)}.visit_date >= ${filters.start}::date`
      : sql`true`;
  return sql`
    filtered_places as (
      select r.* from restaurants r where
        ${filters.restaurantId ? sql`r.id = ${filters.restaurantId}::uuid` : sql`true`}
        and ${filters.cuisine ? sql`${filters.cuisine} = any(r.cuisines)` : sql`true`}
    ),
    base_visits as (
      select v.* from visits v join filtered_places r on r.id = v.restaurant_id
      where ${filters.profileId ? sql`v.profile_id = ${filters.profileId}` : sql`true`}
    ),
    history as (select v.* from base_visits v where ${start("v")} and ${end("v")}),
    ranked as (
      select v.*, row_number() over (partition by restaurant_id, profile_id order by visit_date desc, created_at desc, id desc) as latest_rank
      from base_visits v where ${end("v")}
    ),
    current_scores as (select v.* from ranked v where latest_rank = 1 and ${start("v")} and rating is not null),
    personal_current as (select v.* from current_scores v where profile_id = ${personalProfileId}),
    place_history as (select restaurant_id, count(*)::int visit_count from history group by restaurant_id),
    place_scores as (
      select c.restaurant_id, ${average("c")} as average, count(*)::int reviewer_count,
        case when count(*) >= 2 then stddev_pop(c.rating::numeric(100,80))::text end as agreement
      from current_scores c group by c.restaurant_id
    ),
    counts as (
      select jsonb_build_object(
        'savedRestaurantCount', (select count(*)::int from filtered_places),
        'visitedRestaurantCount', (select count(distinct restaurant_id)::int from history),
        'historicalVisitCount', (select count(*)::int from history),
        'historicalReviewerCount', (select count(distinct profile_id)::int from history),
        'currentScoreCount', (select count(*)::int from current_scores),
        'currentReviewerCount', (select count(distinct profile_id)::int from current_scores),
        'currentlyRatedRestaurantCount', (select count(*)::int from place_scores),
        'personalVisitCount', (select count(*)::int from history where profile_id = ${personalProfileId}),
        'personalVisitedRestaurantCount', (select count(distinct restaurant_id)::int from history where profile_id = ${personalProfileId})
      ) as value
    ),
    filter_options as (
      select jsonb_build_object(
        'profiles', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'initials', p.initials, 'avatar', p.avatar) order by p.name, p.id) from profiles p), '[]'::jsonb),
        'restaurants', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name) order by r.name, r.id) from restaurants r), '[]'::jsonb),
        'cuisines', coalesce((select jsonb_agg(t.name order by t.name) from (select distinct unnest(cuisines) as name from restaurants) t where t.name is not null and t.name <> ''), '[]'::jsonb)
      ) as value
    )`;
}

function dashboardSql(limit: number) {
  return sql`
    select jsonb_build_object(
      'recentVisits', jsonb_build_object(
        'data', coalesce((select jsonb_agg(t.value order by t.visit_date desc, t.created_at desc, t.id desc) from (
          select v.id, v.visit_date, v.created_at, ${visitJson("v")} || jsonb_build_object('restaurant', ${restaurantJson("r")},
            'profile', jsonb_build_object('id', p.id, 'name', p.name, 'initials', p.initials, 'avatar', p.avatar)) as value
          from history v join filtered_places r on r.id = v.restaurant_id join profiles p on p.id = v.profile_id
          order by v.visit_date desc, v.created_at desc, v.id desc limit ${limit}
        ) t), '[]'::jsonb),
        'limit', ${limit}::int, 'total', (select count(*)::int from history), 'hasMore', (select count(*) > ${limit} from history)
      ),
      'recentlyReviewedPlaces', jsonb_build_object(
        'data', coalesce((select jsonb_agg(t.value order by t.visit_date desc, t.created_at desc, t.id desc) from (
          select v.id, v.visit_date, v.created_at, jsonb_build_object('restaurant', ${restaurantJson("r")}, 'latestVisit', ${visitJson("v")},
            'currentRating', jsonb_build_object('average', s.average, 'agreement', s.agreement, 'reviewerCount', coalesce(s.reviewer_count, 0), 'visitCount', coalesce(h.visit_count, 0))) as value
          from personal_current v join filtered_places r on r.id = v.restaurant_id
          left join place_scores s on s.restaurant_id = v.restaurant_id left join place_history h on h.restaurant_id = v.restaurant_id
          order by v.visit_date desc, v.created_at desc, v.id desc limit ${limit}
        ) t), '[]'::jsonb),
        'limit', ${limit}::int, 'total', (select count(*)::int from personal_current), 'hasMore', (select count(*) > ${limit} from personal_current)
      )
    ) as value`;
}

function analyticsSql(profileId: string | null) {
  return sql`
    select jsonb_build_object(
      'leaderboard', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'average', s.average, 'agreement', s.agreement,
        'reviewerCount', s.reviewer_count, 'visitCount', coalesce(h.visit_count, 0)) order by s.average::numeric desc, r.name, r.id)
        from place_scores s join filtered_places r on r.id = s.restaurant_id left join place_history h on h.restaurant_id = r.id), '[]'::jsonb),
      'timeline', coalesce((select jsonb_agg(t.value order by t.date) from (
        select v.visit_date as date, jsonb_build_object('date', v.visit_date::text, 'average', ${average("v")}, 'visitCount', count(*)::int,
          'ratedVisitCount', count(v.rating)::int, 'reviewerCount', count(distinct v.profile_id)::int, 'restaurantCount', count(distinct v.restaurant_id)::int) as value
        from history v group by v.visit_date
      ) t), '[]'::jsonb),
      'comparison', coalesce((select jsonb_agg(jsonb_build_object('profileId', p.id, 'name', p.name, 'average', c.average,
        'placeCount', coalesce(c.place_count, 0), 'visitCount', coalesce(h.visit_count, 0)) order by p.name, p.id)
        from profiles p left join profile_scores c on c.profile_id = p.id left join profile_history h on h.profile_id = p.id
        where ${profileId ? sql`p.id = ${profileId}` : sql`true`}), '[]'::jsonb),
      'cuisines', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'average', c.average, 'scoreCount', coalesce(c.score_count, 0),
        'reviewerCount', coalesce(c.reviewer_count, 0), 'restaurantCount', coalesce(c.restaurant_count, 0), 'visitCount', coalesce(h.visit_count, 0))
        order by c.average::numeric desc nulls last, t.name)
        from (select distinct name from cuisine_memberships) t left join cuisine_scores c on c.name = t.name left join cuisine_history h on h.name = t.name), '[]'::jsonb),
      'spending', (select jsonb_build_object('currency', 'USD', 'recordedVisitCount', count(amount_spent)::int,
        'totalCents', sum(amount_spent * 100)::bigint, 'averageCents', round(avg(amount_spent * 100), 0)::bigint, 'averageRounding', 'nearest-cent-half-up') from history),
      'recommendationActivity', (select jsonb_build_object(
        'selectedCount', s.selected_count, 'dismissedCount', s.dismissed_count,
        'linkedSelectionCount', s.linked_selection_count, 'linkedVisitCount', l.visit_count,
        'linkedProfileCount', l.profile_count,
        'linkedSelectionRatePercent', case when s.selected_count = 0 then null else round(s.linked_selection_count::numeric * 100 / s.selected_count, 2)::text end)
        from recommendation_selection_summary s cross join recommendation_link_summary l)
    ) as value`;
}

function recommendationActivityCtes(
  filters: EffectiveReportFilters,
  timeZone: string,
) {
  const createdDate = sql`(r.created_at at time zone ${timeZone})::date`;
  const start = filters.start
    ? sql`${createdDate} >= ${filters.start}::date`
    : sql`true`;
  const end = filters.end
    ? sql`${createdDate} <= ${filters.end}::date`
    : sql`true`;
  const profile = filters.profileId
    ? sql`f.profile_id = ${filters.profileId}`
    : sql`true`;
  const placeMatches =
    filters.restaurantId || filters.cuisine
      ? sql`(
        (s.restaurant_id is not null and ${filters.restaurantId ? sql`s.restaurant_id = ${filters.restaurantId}::uuid` : sql`true`}
          and ${filters.cuisine ? sql`exists(select 1 from restaurants target where target.id = s.restaurant_id and ${filters.cuisine} = any(target.cuisines))` : sql`true`})
        or exists(select 1 from recommendation_visit_links l join history h on h.id = l.visit_id join restaurants target on target.id = h.restaurant_id
          where l.run_id = f.run_id and l.profile_id = f.profile_id and l.result_id = f.result_id
            and ${filters.restaurantId ? sql`target.id = ${filters.restaurantId}::uuid` : sql`true`}
            and ${filters.cuisine ? sql`${filters.cuisine} = any(target.cuisines)` : sql`true`})
      )`
      : sql`true`;
  return sql`,
    recommendation_feedback_scope as (
      select f.run_id, f.profile_id, f.result_id, f.choice
      from recommendation_feedback f
      join recommendation_runs r on r.id = f.run_id
      join recommendation_results s on s.run_id = f.run_id and s.id = f.result_id
      where ${start} and ${end} and ${profile} and ${placeMatches}
    ),
    recommendation_links_scope as (
      select distinct l.run_id, l.profile_id, l.visit_id
      from recommendation_visit_links l
      join recommendation_feedback_scope f on f.run_id = l.run_id and f.profile_id = l.profile_id and f.result_id = l.result_id and f.choice = 'selected'
      join history h on h.id = l.visit_id
    ),
    recommendation_selection_summary as (
      select count(*) filter (where f.choice = 'selected')::int as selected_count,
        count(*) filter (where f.choice = 'dismissed')::int as dismissed_count,
        count(*) filter (where f.choice = 'selected' and exists(select 1 from recommendation_links_scope l where l.run_id = f.run_id and l.profile_id = f.profile_id))::int as linked_selection_count
      from recommendation_feedback_scope f
    ),
    recommendation_link_summary as (
      select count(distinct visit_id)::int as visit_count, count(distinct profile_id)::int as profile_count
      from recommendation_links_scope
    )`;
}

// Strip numeric scale padding without rounding values to display precision.
function normalizeDecimals(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeDecimals);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      ["average", "agreement", "currentAverage"].includes(key) &&
      typeof item === "string"
        ? new Decimal(item).toString()
        : normalizeDecimals(item),
    ]),
  );
}

export function createReportingRepository<Q extends PgQueryResultHKT>(
  db: PgDatabase<Q, typeof schema>,
) {
  async function report(
    mode: "dashboard" | "analytics",
    filters: EffectiveReportFilters,
    personalProfileId: string,
    recentLimit = 6,
    timeZone = "America/Los_Angeles",
  ) {
    const additionalCtes =
      mode === "analytics"
        ? sql`${recommendationActivityCtes(filters, timeZone)},
      profile_scores as (select c.profile_id, ${average("c")} as average, count(*)::int place_count from current_scores c group by c.profile_id),
      profile_history as (select profile_id, count(*)::int visit_count from history group by profile_id),
      cuisine_memberships as (select distinct r.id restaurant_id, t.name from filtered_places r cross join lateral unnest(r.cuisines) t(name) where t.name is not null and t.name <> ''),
      cuisine_scores as (select m.name, ${average("c")} as average, count(*)::int score_count, count(distinct c.profile_id)::int reviewer_count,
        count(distinct c.restaurant_id)::int restaurant_count from cuisine_memberships m join current_scores c on c.restaurant_id = m.restaurant_id group by m.name),
      cuisine_history as (select m.name, count(*)::int visit_count from cuisine_memberships m join history h on h.restaurant_id = m.restaurant_id group by m.name)`
        : sql``;
    const reportSql =
      mode === "analytics"
        ? analyticsSql(filters.profileId)
        : dashboardSql(recentLimit);
    const result = await db.execute(sql`
      with ${sharedCtes(filters, personalProfileId)} ${additionalCtes},
      report as (${reportSql})
      select jsonb_build_object(
        'restaurantExists', ${filters.restaurantId ? sql`exists(select 1 from restaurants where id = ${filters.restaurantId}::uuid)` : sql`true`},
        'profileExists', ${filters.profileId ? sql`exists(select 1 from profiles where id = ${filters.profileId})` : sql`true`},
        'data', (select value from report) || jsonb_build_object('counts', (select value from counts), 'currentAverage', (select ${average("c")} from current_scores c), 'filterOptions', (select value from filter_options))
      ) as report
    `);
    const row = z
      .object({
        rows: z.array(
          z.object({
            report: z.object({
              restaurantExists: z.boolean(),
              profileExists: z.boolean(),
              data: z.unknown(),
            }),
          }),
        ),
      })
      .parse(result).rows[0].report;
    if (!row.restaurantExists)
      throw new ApiError(
        404,
        "NOT_FOUND",
        "The filtered restaurant could not be found.",
        { restaurantId: ["Choose an existing saved restaurant."] },
      );
    if (!row.profileExists)
      throw new ApiError(
        404,
        "NOT_FOUND",
        "The viewed profile could not be found.",
        { profileId: ["Choose an existing journal profile."] },
      );
    const data = normalizeDecimals(row.data);
    if (mode === "dashboard") return dashboardPayloadSchema.parse(data);
    return analyticsPayloadSchema.parse(data);
  }
  return { report };
}

export type ReportingRepository = ReturnType<typeof createReportingRepository>;
