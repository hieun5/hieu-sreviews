import Link from "next/link";
import {
  analyticsQuerySchema,
  analyticsResponseSchema,
  type AnalyticsResponse,
} from "@/contracts/reporting";
import { apiErrorSchema } from "@/contracts/journal";
import { AnalyticsChart } from "@/components/analytics-charts";
import {
  AnalyticsFiltersForm,
  type AnalyticsFilterValues,
} from "@/components/analytics-filters";
import { Rating } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { formatRating } from "@/lib/ratings";
import { friendProfiles } from "@/config/profiles";
import { reportingApi } from "@/server/runtime";

type SearchParams = Record<string, string | string[] | undefined>;

function queryValue(params: SearchParams, key: string) {
  return typeof params[key] === "string" ? params[key] : "";
}

function scopeHref(
  values: AnalyticsFilterValues,
  scope: "group" | "personal",
  search: string,
) {
  const params = new URLSearchParams();
  params.set("view", scope);
  if (search) params.set("q", search);
  if (scope === "personal") params.set("profile", values.profile);
  if (values.restaurant) params.set("restaurant", values.restaurant);
  if (values.cuisine) params.set("cuisine", values.cuisine);
  if (values.start) params.set("start", values.start);
  if (values.end) params.set("end", values.end);
  return `/?${params.toString()}#dashboard-analytics`;
}

export async function DashboardAnalytics({
  searchParams,
  selectedProfileId,
  today,
  search,
}: {
  searchParams: SearchParams;
  selectedProfileId: string;
  today: string;
  search: string;
}) {
  const values: AnalyticsFilterValues = {
    view: queryValue(searchParams, "view") || "group",
    profile: queryValue(searchParams, "profile") || selectedProfileId,
    restaurant: queryValue(searchParams, "restaurant"),
    cuisine: queryValue(searchParams, "cuisine"),
    start: queryValue(searchParams, "start"),
    end: queryValue(searchParams, "end"),
  };
  const rawQuery = {
    view: values.view,
    ...(values.view === "personal" ? { profileId: values.profile } : {}),
    ...(values.restaurant ? { restaurantId: values.restaurant } : {}),
    ...(values.cuisine ? { cuisine: values.cuisine } : {}),
    ...(values.start ? { start: values.start } : {}),
    ...(values.end ? { end: values.end } : {}),
  };
  const query = analyticsQuerySchema.safeParse(rawQuery);
  let data: AnalyticsResponse["data"] | null = null;
  let errorMessage: string | null = null;
  if (query.success) {
    const params = new URLSearchParams(query.data);
    const response = await reportingApi.analytics(
      new Request(`http://localhost/api/analytics?${params}`),
    );
    const body: unknown = await response.json();
    if (response.ok) data = analyticsResponseSchema.parse(body).data;
    else {
      const parsed = apiErrorSchema.safeParse(body);
      errorMessage = parsed.success
        ? parsed.data.error.message
        : "Analytics could not be loaded.";
    }
  } else {
    errorMessage = "Check the analytics filters and try again.";
  }

  const profiles = data?.filterOptions.profiles ?? friendProfiles;
  const places = data?.filterOptions.restaurants ?? [];
  const cuisines = data?.filterOptions.cuisines ?? [];
  const viewedProfile = profiles.find(({ id }) => id === values.profile)?.name;

  return (
    <aside
      id="dashboard-analytics"
      tabIndex={-1}
      className="panel dashboard-analytics"
      aria-labelledby="analytics-title"
    >
      <div className="dashboard-analytics-header">
        <div>
          <p className="muted mb-1 text-[11px] uppercase tracking-wider">
            {values.view === "group" ? "Group" : (viewedProfile ?? "Personal")}
          </p>
          <h2 id="analytics-title" className="section-title">
            Analytics
          </h2>
        </div>
        <div className="analytics-scope" aria-label="Analytics scope">
          <Link
            href={scopeHref(values, "group", search)}
            aria-current={values.view === "group" ? "page" : undefined}
          >
            Group
          </Link>
          <Link
            href={scopeHref(values, "personal", search)}
            aria-current={values.view === "personal" ? "page" : undefined}
          >
            Personal
          </Link>
        </div>
      </div>

      <details className="dashboard-filter-details">
        <summary>Filters</summary>
        <AnalyticsFiltersForm
          key={JSON.stringify(values)}
          values={values}
          profiles={profiles.map(({ id, name }) => ({ id, name }))}
          places={places}
          cuisines={cuisines}
          today={today}
          action="/"
          search={search}
        />
      </details>

      {errorMessage ? (
        <p className="notice notice-error mb-0" role="alert">
          {errorMessage}
        </p>
      ) : data ? (
        <>
          <div className="dashboard-analytics-summary">
            <div className="analytics-average">
              <Rating value={data.currentAverage} />
              <p className="muted mb-0 mt-1 text-[11px]">
                Current average · {data.counts.currentScoreCount} scores
              </p>
            </div>
            <div className="analytics-counts">
              <div>
                <span>{data.counts.historicalVisitCount}</span>
                <small>visits</small>
              </div>
              <div>
                <span>{data.counts.currentlyRatedRestaurantCount}</span>
                <small>rated places</small>
              </div>
              <div>
                <span>{data.counts.currentReviewerCount}</span>
                <small>reviewers</small>
              </div>
            </div>
          </div>

          <section className="dashboard-analytics-section">
            <div className="dashboard-section-heading">
              <h3>Top places</h3>
              <span>Current scores / 10</span>
            </div>
            {data.leaderboard.length ? (
              <ol className="analytics-rank-list">
                {data.leaderboard.slice(0, 5).map((place, index) => (
                  <li key={place.id}>
                    <span className="analytics-rank-number">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/places/${place.id}`}
                        className="analytics-place-name"
                      >
                        {place.name}
                      </Link>
                      <p className="muted mb-0 text-[10px]">
                        {place.reviewerCount} reviewers · {place.visitCount}{" "}
                        visits
                      </p>
                    </div>
                    <span className="analytics-score">
                      {formatRating(place.average)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted mb-0 text-sm">No current ratings yet.</p>
            )}
          </section>

          <section className="dashboard-analytics-section">
            <div className="dashboard-section-heading">
              <h3>Cuisine favorites</h3>
              <span>Current averages</span>
            </div>
            {data.cuisines.length ? (
              <ul className="analytics-cuisine-list">
                {data.cuisines.slice(0, 5).map((cuisine) => (
                  <li key={cuisine.name}>
                    <span>{cuisine.name}</span>
                    <span className="analytics-score">
                      {formatRating(cuisine.average)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted mb-0 text-sm">
                Cuisine data will appear with ratings.
              </p>
            )}
          </section>

          <details className="dashboard-more-analytics">
            <summary>More insights</summary>
            <div className="mt-4">
              <p className="dashboard-section-caption">
                Rating history · visit averages
              </p>
              <AnalyticsChart kind="timeline" data={data.timeline.slice(-10)} />
              {data.timeline.length ? (
                <p className="muted mb-4 text-[10px]">
                  {formatDate(data.timeline[0].date)} to{" "}
                  {formatDate(data.timeline[data.timeline.length - 1].date)} ·{" "}
                  {data.timeline.reduce(
                    (total, row) => total + row.visitCount,
                    0,
                  )}{" "}
                  visits
                </p>
              ) : null}
              <p className="dashboard-section-caption">
                Friend comparison · current scores
              </p>
              <ul className="analytics-cuisine-list">
                {data.comparison.map((friend) => (
                  <li key={friend.profileId}>
                    <span>{friend.name}</span>
                    <span className="text-right">
                      <strong>{formatRating(friend.average)}</strong>
                      <small className="block text-muted">
                        {friend.placeCount} places · {friend.visitCount} visits
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="dashboard-section-caption mt-4">Spending · USD</p>
              {data.spending.recordedVisitCount ? (
                <p className="muted mb-0 text-xs">
                  ${(data.spending.totalCents! / 100).toFixed(2)} total · $
                  {(data.spending.averageCents! / 100).toFixed(2)} per recorded
                  visit · {data.spending.recordedVisitCount} visits recorded
                </p>
              ) : (
                <p className="muted mb-0 text-xs">No spending recorded.</p>
              )}
              <p className="dashboard-section-caption mt-4">
                Recommendation activity
              </p>
              <p className="muted mb-0 text-xs">
                {data.recommendationActivity.selectedCount} selected ·{" "}
                {data.recommendationActivity.dismissedCount} dismissed ·{" "}
                {data.recommendationActivity.linkedVisitCount} linked visits
              </p>
            </div>
          </details>
        </>
      ) : null}
    </aside>
  );
}
