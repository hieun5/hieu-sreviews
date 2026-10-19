import Link from "next/link";
import { Info } from "lucide-react";
import {
  analyticsResponseSchema,
  type AnalyticsResponse,
} from "@/contracts/reporting";
import { apiErrorSchema } from "@/contracts/journal";
import { AnalyticsChart } from "@/components/analytics-charts";
import {
  AnalyticsFiltersForm,
  type AnalyticsFilterValues,
} from "@/components/analytics-filters";
import { DatabaseSetup, PageHeader, Rating } from "@/components/ui";
import {
  DEFAULT_TIME_ZONE,
  formatDate,
  todayInTimeZone,
  validCalendarDate,
} from "@/lib/dates";
import { requireProfile } from "@/lib/profile";
import { formatRating } from "@/lib/ratings";
import { friendProfiles } from "@/config/profiles";
import { reportingApi } from "@/server/runtime";

export const metadata = { title: "Analytics" };

function ChartSection({
  title,
  label,
  description,
  children,
}: {
  title: string;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel min-w-0 overflow-hidden">
      <div className="px-6 pt-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="section-title">{title}</h2>
          <span className="badge">{label}</span>
        </div>
        <p className="muted mb-0 text-xs">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();
  const query = await searchParams;
  const get = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : "";
  const values: AnalyticsFilterValues = {
    view: get("view") || "group",
    profile: get("profile") || profile.id,
    restaurant: get("restaurant"),
    cuisine: get("cuisine"),
    start: get("start"),
    end: get("end"),
  };
  const invalid =
    !["personal", "group"].includes(values.view) ||
    (values.start !== "" && !validCalendarDate(values.start)) ||
    (values.end !== "" && !validCalendarDate(values.end)) ||
    (values.start !== "" && values.end !== "" && values.start > values.end);
  const today = todayInTimeZone(
    new Date(),
    process.env.APP_TIME_ZONE || DEFAULT_TIME_ZONE,
  );
  let data: AnalyticsResponse["data"] | null = null;
  let loadError: string | null = null;
  let databaseMissing = false;
  if (!invalid) {
    const params = new URLSearchParams({ view: values.view });
    if (values.view === "personal") params.set("profileId", values.profile);
    if (values.restaurant) params.set("restaurantId", values.restaurant);
    if (values.cuisine) params.set("cuisine", values.cuisine);
    if (values.start) params.set("start", values.start);
    if (values.end) params.set("end", values.end);
    const response = await reportingApi.analytics(
      new Request(`http://localhost/api/analytics?${params.toString()}`),
    );
    const body: unknown = await response.json();
    if (response.ok) data = analyticsResponseSchema.parse(body).data;
    else {
      const parsedError = apiErrorSchema.safeParse(body);
      const code = parsedError.success ? parsedError.data.error.code : null;
      databaseMissing = code === "DATABASE_UNCONFIGURED";
      loadError = parsedError.success
        ? parsedError.data.error.message
        : "Analytics could not be loaded.";
    }
  }
  const profiles = data?.filterOptions.profiles ?? friendProfiles;
  const places = data?.filterOptions.restaurants ?? [];
  const categories = data?.filterOptions.cuisines ?? [];
  const viewedProfileName = profiles.find(
    (friend) => friend.id === values.profile,
  )?.name;
  return (
    <>
      <PageHeader title="Analytics" />
      <AnalyticsFiltersForm
        key={JSON.stringify(values)}
        values={values}
        profiles={profiles.map(({ id, name }) => ({ id, name }))}
        places={places}
        cuisines={categories}
        today={today}
      />
      <details className="mb-6 text-xs text-muted">
        <summary className="cursor-pointer">
          <Info size={13} className="mr-1 inline" aria-hidden="true" />
          How ratings and date filters work
        </summary>
        <p className="mb-0 mt-3 max-w-4xl leading-relaxed">
          Current-rating charts use each reviewer’s latest visit on or before
          the selected end date. That visit must also fall on or after the start
          date to count. Earlier visits are never substituted. The timeline and
          spending summaries use every visit within the range. Missing ratings
          and spending are never treated as zero.
        </p>
      </details>
      {databaseMissing ? (
        <DatabaseSetup />
      ) : invalid ? (
        <p role="alert" className="notice notice-error">
          Check your filters. Use valid dates with the start on or before the
          end, and choose an available profile, place, and category.
        </p>
      ) : loadError ? (
        <p role="alert" className="notice notice-error">
          {loadError}
        </p>
      ) : data ? (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="mb-0 text-sm font-semibold">
              {values.view === "group"
                ? "Our group"
                : `${viewedProfileName}’s journal`}
            </p>
            <span className="text-[11px] text-muted">
              {values.start ? formatDate(values.start) : "First visit"} →{" "}
              {values.end ? formatDate(values.end) : "Today"}
            </span>
          </div>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="panel p-5">
              <Rating value={data.currentAverage} />
              <p className="stat-label">Current-rating average</p>
              <p className="muted mb-0 mt-2 text-[10px]">
                {data.counts.currentScoreCount} current scores ·{" "}
                {data.counts.currentReviewerCount} reviewers ·{" "}
                {data.counts.historicalVisitCount} visits
              </p>
            </div>
            <div className="panel p-5">
              <p className="stat-value mb-0">
                {data.counts.currentlyRatedRestaurantCount}
              </p>
              <p className="stat-label">Places with current scores</p>
            </div>
            <div className="panel p-5">
              <p className="stat-value mb-0">
                {data.counts.historicalVisitCount}
              </p>
              <p className="stat-label">Historical visits in range</p>
            </div>
            <div className="panel p-5">
              <p className="stat-value mb-0">
                {data.spending.recordedVisitCount}
              </p>
              <p className="stat-label">Visits with spending recorded</p>
            </div>
          </div>
          <div className="mb-6 grid gap-5 xl:grid-cols-2">
            <ChartSection
              title="Top places"
              label="Current ratings"
              description="One latest score per reviewer. Highest averages first."
            >
              <AnalyticsChart kind="leaderboard" data={data.leaderboard} />
              {data.leaderboard.length ? (
                <div className="table-wrap">
                  <table>
                    <caption className="sr-only">
                      Restaurant leaderboard and group agreement
                    </caption>
                    <thead>
                      <tr>
                        <th>Place</th>
                        <th>Average</th>
                        <th>Reviewers / visits</th>
                        <th>Agreement σ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leaderboard.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <Link
                              href={`/places/${row.id}`}
                              className="font-semibold text-accent hover:underline"
                            >
                              {row.name}
                            </Link>
                          </td>
                          <td>{formatRating(row.average)}</td>
                          <td>
                            {row.reviewerCount} / {row.visitCount}
                          </td>
                          <td>
                            {row.agreement === null
                              ? "Needs 2 reviewers"
                              : formatRating(row.agreement)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="muted px-5 text-[10px]">
                    Agreement is population standard deviation. Lower values
                    mean closer scores.
                  </p>
                </div>
              ) : null}
            </ChartSection>
            <ChartSection
              title="Rating history"
              label="Historical visits"
              description="Daily averages of all visits, including return visits."
            >
              <AnalyticsChart kind="timeline" data={data.timeline} />
              {data.timeline.length ? (
                <details className="border-t border-line p-5 text-xs">
                  <summary className="cursor-pointer text-accent">
                    View timeline data & counts
                  </summary>
                  <div className="table-wrap mt-3">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Average</th>
                          <th>Reviewers / visits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.timeline.map((row) => (
                          <tr key={row.date}>
                            <td>{formatDate(row.date)}</td>
                            <td>{formatRating(row.average)}</td>
                            <td>
                              {row.reviewerCount} / {row.visitCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}
            </ChartSection>
            <ChartSection
              title="Friends"
              label="Current ratings"
              description="Each person’s average across their currently rated places."
            >
              <AnalyticsChart kind="comparison" data={data.comparison} />
              {data.comparison.length ? (
                <div className="table-wrap">
                  <table>
                    <caption className="sr-only">Friend comparison</caption>
                    <thead>
                      <tr>
                        <th>Reviewer</th>
                        <th>Average</th>
                        <th>Places / visits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.comparison.map((row) => (
                        <tr key={row.profileId}>
                          <td>{row.name}</td>
                          <td>
                            {row.average === null
                              ? "No scores"
                              : formatRating(row.average)}
                          </td>
                          <td>
                            {row.placeCount} / {row.visitCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="muted px-5 text-[10px]">
                    Each row represents one reviewer. Friends may have reviewed
                    different places.
                  </p>
                </div>
              ) : null}
            </ChartSection>
            <ChartSection
              title="Cuisines"
              label="Current ratings"
              description="Current scores grouped by cuisine. A place may appear in multiple categories."
            >
              <AnalyticsChart kind="cuisines" data={data.cuisines} />
              {data.cuisines.length ? (
                <div className="table-wrap">
                  <table>
                    <caption className="sr-only">Cuisine preferences</caption>
                    <thead>
                      <tr>
                        <th>Cuisine</th>
                        <th>Average</th>
                        <th>Reviewers / visits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cuisines.map((row) => (
                        <tr key={row.name}>
                          <td>
                            {row.name}
                            <span className="muted ml-2 text-[10px]">
                              {row.scoreCount} scores
                            </span>
                          </td>
                          <td>{formatRating(row.average)}</td>
                          <td>
                            {row.reviewerCount} / {row.visitCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </ChartSection>
          </div>
          <section className="panel p-6">
            <p className="muted mb-3 text-xs">Historical visits · USD</p>
            <h2 className="section-title mb-4">Spending</h2>
            {data.spending.recordedVisitCount ? (
              <div className="flex flex-wrap gap-x-12 gap-y-4">
                <div>
                  <p className="mb-1 text-xl font-semibold tabular-nums">
                    ${(data.spending.totalCents! / 100).toFixed(2)}
                  </p>
                  <p className="muted mb-0 text-xs">
                    Sum of per-person amounts
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xl font-semibold tabular-nums">
                    ${(data.spending.averageCents! / 100).toFixed(2)}
                  </p>
                  <p className="muted mb-0 text-xs">
                    Average recorded per person, per visit
                  </p>
                </div>
                <p className="muted mb-0 self-end text-xs">
                  Based on {data.spending.recordedVisitCount} of{" "}
                  {data.counts.historicalVisitCount} visits. Unrecorded amounts
                  are excluded.
                </p>
              </div>
            ) : (
              <p className="muted mb-0 text-sm">
                No spending recorded for these visits. Add an amount when
                logging a visit to see a summary here.
              </p>
            )}
          </section>
          <section className="panel mt-6 p-6">
            <p className="muted mb-3 text-xs">
              Recommendation feedback ·{" "}
              {values.view === "group" ? "Group" : viewedProfileName}
            </p>
            <h2 className="section-title mb-4">What the group chose</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="stat-value mb-0">
                  {data.recommendationActivity.selectedCount}
                </p>
                <p className="stat-label">Selected</p>
              </div>
              <div>
                <p className="stat-value mb-0">
                  {data.recommendationActivity.dismissedCount}
                </p>
                <p className="stat-label">Dismissed</p>
              </div>
              <div>
                <p className="stat-value mb-0">
                  {data.recommendationActivity.linkedVisitCount}
                </p>
                <p className="stat-label">Visits linked</p>
              </div>
              <div>
                <p className="stat-value mb-0">
                  {data.recommendationActivity.linkedSelectionRatePercent ===
                  null
                    ? "—"
                    : `${data.recommendationActivity.linkedSelectionRatePercent}%`}
                </p>
                <p className="stat-label">Selected places later visited</p>
              </div>
            </div>
            <p className="muted mb-0 mt-3 text-xs">
              Feedback is scoped by recommendation-run date; linked visits use
              the selected visit-date filters. A dash means no selections to
              compare.
            </p>
          </section>
        </>
      ) : null}
    </>
  );
}
