import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import {
  DatabaseSetup,
  EmptyState,
  PageHeader,
  PlaceCard,
} from "@/components/ui";
import { VisitList } from "@/components/visit-list";
import { getJournal } from "@/lib/data";
import { requireProfile } from "@/lib/profile";
import {
  compareVisits,
  currentRatings,
  restaurantSummary,
} from "@/lib/ratings";

export default async function HomePage() {
  const profile = await requireProfile();
  const journal = await getJournal();
  const personalVisits =
    journal?.visits.filter((visit) => visit.profileId === profile.id) ?? [];
  const current = currentRatings(personalVisits).sort(compareVisits);
  const recentPlaces = current.slice(0, 3).flatMap((visit) => {
    const place = journal?.restaurants.find(
      (item) => item.id === visit.restaurantId,
    );
    return place ? [place] : [];
  });

  return (
    <>
      <PageHeader
        title={`Hey, ${profile.name}`}
        action={
          <div className="flex gap-2">
            <Link href="/places/new" className="btn btn-secondary">
              Add a place
            </Link>
            <Link href="/places" className="btn">
              <Plus size={16} aria-hidden="true" />
              Log a visit
            </Link>
          </div>
        }
      />
      {journal ? (
        <>
          <dl className="mb-9 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
            {[
              { label: "your visits", value: personalVisits.length },
              { label: "your places", value: current.length },
              { label: "group visits", value: journal.visits.length },
              { label: "saved places", value: journal.restaurants.length },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <dt>{label}</dt>
                <dd className="m-0 text-sm font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="section-title">Your recent places</h2>
            <Link
              href="/places"
              className="flex items-center gap-1 text-xs text-accent"
            >
              All places
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {recentPlaces.length ? (
            <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentPlaces.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  {...restaurantSummary(journal.visits, place.id)}
                />
              ))}
            </div>
          ) : (
            <div className="panel mb-8">
              <EmptyState
                title="No visits yet"
                description="Pick a place and log your first visit."
                href="/places"
                action="Find a place"
              />
            </div>
          )}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">Recent visits</h2>
            <span className="muted text-xs">Everyone</span>
          </div>
          <section className="panel">
            {journal.visits.length ? (
              <VisitList
                visits={[...journal.visits].sort(compareVisits).slice(0, 6)}
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
        </>
      ) : (
        <DatabaseSetup />
      )}
    </>
  );
}
