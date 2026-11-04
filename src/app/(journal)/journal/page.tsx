import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { DatabaseSetup, EmptyState, PageHeader } from "@/components/ui";
import { VisitList } from "@/components/visit-list";
import { getJournal } from "@/lib/data";
import { requireProfile } from "@/lib/profile";
import { normalizePlace } from "@/lib/validation";

export const metadata = { title: "Our journal" };
export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [profile, journal, params] = await Promise.all([
    requireProfile(),
    getJournal(),
    searchParams,
  ]);
  const personal = params.view === "personal";
  const visits =
    journal?.visits.filter(
      (visit) => !personal || visit.profileId === profile.id,
    ) ?? [];
  const query = typeof params.q === "string" ? params.q.slice(0, 300) : "";
  const normalized = normalizePlace(query);
  const journalHref = (personalView: boolean, search = query) => {
    const params = new URLSearchParams();
    if (personalView) params.set("view", "personal");
    if (search) params.set("q", search);
    return `/journal${params.size ? `?${params}` : ""}`;
  };
  const filtered = visits.filter(
    (visit) =>
      !normalized ||
      normalizePlace(
        `${journal?.restaurants.find((place) => place.id === visit.restaurantId)?.name ?? ""} ${visit.orderDescription ?? ""} ${visit.reviewText ?? ""}`,
      ).includes(normalized),
  );
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Our journal" />
      <div className="section-heading">
        <nav className="filter-tabs mb-0" aria-label="Whose reviews">
          <Link
            href={journalHref(false)}
            aria-current={!personal ? "page" : undefined}
          >
            Everyone
          </Link>
          <Link
            href={journalHref(true)}
            aria-current={personal ? "page" : undefined}
          >
            Your reviews
          </Link>
        </nav>
        <Link href="/places" className="text-link">
          Places
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <form
        action="/journal"
        role="search"
        className="restaurant-search-form journal-search-form"
      >
        {personal ? <input type="hidden" name="view" value="personal" /> : null}
        <div className="search-input-wrap">
          <Search size={19} aria-hidden="true" />
          <label htmlFor="journal-search" className="sr-only">
            Search reviews
          </label>
          <input
            id="journal-search"
            name="q"
            className="input"
            type="search"
            maxLength={300}
            defaultValue={query}
            key={query}
            enterKeyHint="search"
          />
        </div>
        <button className="btn btn-secondary">Search</button>
        {query ? (
          <Link
            href={journalHref(personal, "")}
            className="btn btn-quiet"
            aria-label="Clear search"
          >
            Clear
          </Link>
        ) : null}
      </form>
      {!journal ? (
        <DatabaseSetup />
      ) : filtered.length ? (
        <VisitList
          allVisits={journal.visits}
          visits={filtered}
          profiles={journal.profiles}
          restaurants={journal.restaurants}
          selectedProfileId={profile.id}
          showPlace
          controls
        />
      ) : (
        <EmptyState
          title={
            query
              ? "No bites found"
              : personal
                ? "Your first bite awaits"
                : "The table’s yours"
          }
          description={
            query
              ? "Try a different place or something you ordered."
              : "Log a meal and leave a little review for the group."
          }
          href={query ? journalHref(personal, "") : "/"}
          action={query ? "Clear search" : "Log a meal"}
        />
      )}
    </div>
  );
}
