import Link from "next/link";
import {
  DatabaseSetup,
  EmptyState,
  PageHeader,
  PlaceCard,
} from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { RestaurantSearch } from "@/components/restaurant-search";
import { getJournal } from "@/lib/data";
import { requireProfile } from "@/lib/profile";
import { restaurantSummary } from "@/lib/ratings";
import { normalizePlace } from "@/lib/validation";

export const metadata = { title: "Places" };
export default async function PlacesPage({
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
  const normalized = normalizePlace(query);
  const places =
    journal?.restaurants.filter(
      (place) =>
        !normalized ||
        normalizePlace(
          `${place.name} ${place.address} ${place.cuisines.join(" ")}`,
        ).includes(normalized),
    ) ?? [];
  return (
    <>
      <PageHeader title="Places" />
      <RestaurantSearch key={query} query={query} />
      {journal ? (
        <div className="mb-5 flex items-center gap-3">
          <div
            className="rounded-[10px] border border-line bg-white px-4 py-2 text-sm"
            role="status"
          >
            <strong className="text-lg">{places.length}</strong>{" "}
            <span className="text-muted">
              {places.length === 1 ? "place" : "places"}
            </span>
          </div>
          <Link
            href="/profiles"
            aria-label={`Reviewing as ${profile.name}. Switch reviewer`}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full"
            title={`Reviewing as ${profile.name}`}
          >
            <Avatar profile={profile} size={40} />
          </Link>
        </div>
      ) : null}
      {!journal ? (
        <DatabaseSetup />
      ) : places.length ? (
        <>
          <div className="place-grid">
            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                {...restaurantSummary(journal.visits, place.id)}
                showRemove
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title={
            query ? "Nothing on this menu" : "Let’s find our first favorite"
          }
          description={
            query
              ? "Try another name or cuisine."
              : "Add a place with your first review. Everyone can come back to it later."
          }
          href={query ? "/places" : "/places/new"}
          action={query ? "Show all places" : "Add our first place"}
        />
      )}
    </>
  );
}
