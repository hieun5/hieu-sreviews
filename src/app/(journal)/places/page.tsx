import Link from "next/link";
import { Plus, Search } from "lucide-react";
import {
  DatabaseSetup,
  EmptyState,
  PageHeader,
  PlaceCard,
  StatusNotice,
} from "@/components/ui";
import { getJournal } from "@/lib/data";
import { getPlaceSearchProvider } from "@/lib/place-provider";
import { requireProfile } from "@/lib/profile";
import { restaurantSummary } from "@/lib/ratings";
import { normalizePlace } from "@/lib/validation";

export const metadata = { title: "Places" };

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    kind?: string;
    cuisine?: string;
    error?: string;
  }>;
}) {
  await requireProfile();
  const params = await searchParams;
  const journal = await getJournal();
  const q = typeof params.q === "string" ? params.q.slice(0, 300) : "";
  const query = normalizePlace(q);
  const kinds = ["restaurant", "cafe"].includes(params.kind ?? "")
    ? params.kind
    : "";
  const cuisine = typeof params.cuisine === "string" ? params.cuisine : "";
  const places =
    journal?.restaurants.filter(
      (place) =>
        (!query ||
          normalizePlace(
            `${place.name} ${place.address} ${place.cuisines.join(" ")}`,
          ).includes(query)) &&
        (!kinds || place.kind === kinds) &&
        (!cuisine || place.cuisines.includes(cuisine)),
    ) ?? [];
  const cuisines = [
    ...new Set(journal?.restaurants.flatMap((place) => place.cuisines) ?? []),
  ].sort();
  const provider = getPlaceSearchProvider();
  return (
    <>
      <PageHeader
        title="Places"
        action={
          <Link href="/places/new" className="btn">
            <Plus size={16} aria-hidden="true" />
            Add a place
          </Link>
        }
      />
      <StatusNotice error={params.error} />
      <form
        action="/places"
        className="mb-5 grid gap-3 md:grid-cols-[1fr_160px_170px_auto]"
      >
        <div className="relative">
          <label htmlFor="q" className="sr-only">
            Search saved places
          </label>
          <Search
            size={17}
            className="absolute left-4 top-3.5 text-muted"
            aria-hidden="true"
          />
          <input
            id="q"
            name="q"
            className="input pl-11"
            placeholder="Search saved places, cuisines, or addresses"
            defaultValue={q}
            maxLength={300}
          />
        </div>
        <div>
          <label htmlFor="kind" className="sr-only">
            Place type
          </label>
          <select id="kind" name="kind" className="input" defaultValue={kinds}>
            <option value="">All places</option>
            <option value="restaurant">Restaurants</option>
            <option value="cafe">Cafés</option>
          </select>
        </div>
        <div>
          <label htmlFor="cuisine" className="sr-only">
            Cuisine or category
          </label>
          <select
            id="cuisine"
            name="cuisine"
            className="input"
            defaultValue={cuisine}
          >
            <option value="">All categories</option>
            {cuisines.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-secondary">Search</button>
      </form>
      {!provider ? (
        <p className="muted mb-7 text-xs">
          Searching our saved places only. External search isn’t connected.{" "}
          <Link href="/places/new" className="text-accent underline">
            Add a place manually
          </Link>
          .
        </p>
      ) : null}
      {journal ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="muted mb-0 text-xs">
              {places.length} {places.length === 1 ? "place" : "places"}
              {q || kinds || cuisine ? " matching your filters" : " saved"}
            </p>
            {q || kinds || cuisine ? (
              <Link href="/places" className="text-xs text-accent underline">
                Clear filters
              </Link>
            ) : null}
          </div>
          {places.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {places.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  {...restaurantSummary(journal.visits, place.id)}
                />
              ))}
            </div>
          ) : (
            <section className="panel">
              <EmptyState
                title={
                  journal.restaurants.length ? "No matches" : "No places yet"
                }
                description={
                  journal.restaurants.length
                    ? "Try another search or clear your filters."
                    : "Add a restaurant or café to get started."
                }
                href="/places/new"
                action="Add a place manually"
              />
            </section>
          )}
        </>
      ) : (
        <DatabaseSetup />
      )}
    </>
  );
}
