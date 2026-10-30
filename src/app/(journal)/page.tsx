import Link from "next/link";
import { ArrowDown, Plus } from "lucide-react";
import {
  DatabaseSetup,
  EmptyState,
  PageHeader,
  PlaceCard,
} from "@/components/ui";
import { DashboardAnalytics } from "@/components/dashboard-analytics";
import { RestaurantSearch } from "@/components/restaurant-search";
import { VisitList } from "@/components/visit-list";
import { getJournal } from "@/lib/data";
import { requireProfile } from "@/lib/profile";
import { compareVisits, restaurantSummary } from "@/lib/ratings";
import { normalizePlace } from "@/lib/validation";
import { DEFAULT_TIME_ZONE, todayInTimeZone } from "@/lib/dates";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [profile, journal, params] = await Promise.all([
    requireProfile(),
    getJournal(),
    searchParams,
  ]);
  const query = typeof params.q === "string" ? params.q.slice(0, 300) : "";
  const normalizedQuery = normalizePlace(query);
  const view = typeof params.view === "string" ? params.view : "group";
  const personalVisits =
    journal?.visits.filter((visit) => visit.profileId === profile.id) ?? [];
  const places =
    journal?.restaurants
      .filter(
        (place) =>
          !normalizedQuery ||
          normalizePlace(
            `${place.name} ${place.address} ${place.cuisines.join(" ")}`,
          ).includes(normalizedQuery),
      )
      .toSorted((left, right) => left.name.localeCompare(right.name)) ?? [];
  const today = todayInTimeZone(
    new Date(),
    process.env.APP_TIME_ZONE || DEFAULT_TIME_ZONE,
  );

  return (
    <>
      <PageHeader
        title={`Hey, ${profile.name}`}
        action={
          <div className="journal-actions">
            <RestaurantSearch query={query} view={view} />
            <Link
              href="/places/new"
              className="btn btn-secondary journal-add-place"
            >
              <Plus size={16} aria-hidden="true" />
              Add a place
            </Link>
          </div>
        }
      />
      {journal ? (
        <>
          <dl className="home-stats">
            <div>
              <dt>Your visits</dt>
              <dd>{personalVisits.length}</dd>
            </div>
            <div>
              <dt>Group visits</dt>
              <dd>{journal.visits.length}</dd>
            </div>
            <div>
              <dt>Saved places</dt>
              <dd>{journal.restaurants.length}</dd>
            </div>
          </dl>

          <a href="#dashboard-analytics" className="dashboard-analytics-jump">
            View analytics
            <ArrowDown size={16} aria-hidden="true" />
          </a>

          <div className="dashboard-layout">
            <div className="dashboard-main-column">
              <section aria-labelledby="saved-places-title">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 id="saved-places-title" className="section-title">
                    {query ? "Search results" : "Saved places"}
                  </h2>
                  <span className="muted text-xs">
                    {places.length} {places.length === 1 ? "place" : "places"}
                  </span>
                </div>
                {places.length ? (
                  <div className="dashboard-place-grid mb-8">
                    {places.map((place) => (
                      <PlaceCard
                        key={place.id}
                        place={place}
                        {...restaurantSummary(journal.visits, place.id)}
                        showRemove
                      />
                    ))}
                  </div>
                ) : (
                  <section className="panel mb-8">
                    <EmptyState
                      title={query ? "No places found" : "No places yet"}
                      description={
                        query
                          ? "Try a different restaurant name or category."
                          : "Add a place with your first visit to get started."
                      }
                      href={query ? undefined : "/places/new"}
                      action={query ? undefined : "Add a place"}
                    />
                  </section>
                )}
              </section>

              <section aria-labelledby="recent-visits-title">
                <div className="mb-4 flex items-center justify-between">
                  <h2 id="recent-visits-title" className="section-title">
                    Recent visits
                  </h2>
                  <span className="muted text-xs">Everyone</span>
                </div>
                <section className="panel">
                  {journal.visits.length ? (
                    <VisitList
                      visits={[...journal.visits]
                        .sort(compareVisits)
                        .slice(0, 6)}
                      profiles={journal.profiles}
                      restaurants={journal.restaurants}
                      selectedProfileId={profile.id}
                      showPlace
                    />
                  ) : (
                    <EmptyState
                      title="Nothing here yet"
                      description="New visits from your friends will show up here."
                    />
                  )}
                </section>
              </section>
            </div>

            <DashboardAnalytics
              searchParams={params}
              selectedProfileId={profile.id}
              today={today}
              search={query}
            />
          </div>
        </>
      ) : (
        <DatabaseSetup />
      )}
    </>
  );
}
