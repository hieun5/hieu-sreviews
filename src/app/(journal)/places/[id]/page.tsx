import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Coffee, MapPin, UtensilsCrossed } from "lucide-react";
import { z } from "zod";
import { Avatar } from "@/components/avatar";
import {
  DatabaseSetup,
  EmptyState,
  Rating,
  StatusNotice,
} from "@/components/ui";
import { VisitList } from "@/components/visit-list";
import { findProfile } from "@/config/profiles";
import { getJournal } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { requireProfile } from "@/lib/profile";
import { formatRating, restaurantSummary } from "@/lib/ratings";

export const metadata = { title: "Place journal" };

export default async function RestaurantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const query = await searchParams;
  const journal = await getJournal();
  if (!journal) return <DatabaseSetup />;
  const place = journal.restaurants.find((item) => item.id === id);
  if (!place) notFound();
  const history = journal.visits.filter((visit) => visit.restaurantId === id);
  const summary = restaurantSummary(history, id);
  const Icon = place.kind === "cafe" ? Coffee : UtensilsCrossed;
  return (
    <>
      <Link
        href="/places"
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-accent"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        All places
      </Link>
      <StatusNotice saved={query.saved} error={query.error} />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-full">
          <div className="mb-4 flex items-center gap-3">
            <span className="place-icon">
              <Icon size={24} strokeWidth={1.3} aria-hidden="true" />
            </span>
            <span className="text-xs text-muted">
              {place.kind === "cafe" ? "Café" : "Restaurant"}
            </span>
          </div>
          <h1 className="display mb-3 break-words text-[clamp(28px,3vw,36px)]">
            {place.name}
          </h1>
          {place.address ? (
            <p className="muted mb-4 flex items-center gap-2 text-sm">
              <MapPin size={15} aria-hidden="true" />
              {place.address}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {place.cuisines.map((cuisine) => (
              <span key={cuisine} className="badge">
                {cuisine}
              </span>
            ))}
            {place.priceTier ? (
              <span className="badge">
                Listed tier: {"$".repeat(place.priceTier)}
              </span>
            ) : null}
          </div>
        </div>
        <Link href={`/places/${id}/visits/new`} className="btn">
          {history.some((visit) => visit.profileId === profile.id)
            ? "Review another visit"
            : "Add your review"}
        </Link>
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="panel p-6">
          <p className="muted mb-3 text-xs">Current group average</p>
          <Rating value={summary.average} />
          <p className="muted mb-0 mt-2 text-xs">
            {summary.reviewerCount}{" "}
            {summary.reviewerCount === 1 ? "reviewer" : "reviewers"} ·{" "}
            {summary.visitCount} {summary.visitCount === 1 ? "visit" : "visits"}
          </p>
        </div>
        <div className="panel p-6">
          <p className="muted mb-3 text-xs">Your rating</p>
          <Rating
            value={
              summary.scores.find((visit) => visit.profileId === profile.id)
                ?.rating ?? null
            }
          />
          <p className="muted mb-0 mt-2 text-xs">
            {history.filter((visit) => visit.profileId === profile.id).length}{" "}
            {history.filter((visit) => visit.profileId === profile.id)
              .length === 1
              ? "visit"
              : "visits"}{" "}
            from {profile.name}
          </p>
        </div>
      </div>
      <div>
        <section className="panel overflow-hidden">
          <div className="border-b border-line px-6 py-5">
            <h2 className="section-title mb-2">Latest ratings</h2>
            <p className="muted mb-0 text-xs">
              One current score per reviewer, based on their latest visit.
            </p>
          </div>
          {summary.scores.length ? (
            <div className="divide-y divide-line">
              {journal.profiles.map((friend) => {
                const score = summary.scores.find(
                  (visit) => visit.profileId === friend.id,
                );
                const configured = findProfile(friend.id);
                return (
                  <div
                    key={friend.id}
                    className="flex items-center gap-3 px-6 py-4"
                  >
                    {configured ? (
                      <Avatar profile={configured} size={34} />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="mb-0 text-sm font-semibold">
                        {friend.name}
                      </p>
                      <p className="muted mb-0 text-xs">
                        {score
                          ? formatDate(score.visitDate)
                          : "Hasn’t reviewed this place"}
                      </p>
                    </div>
                    <Rating value={score?.rating ?? null} compact />
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No ratings yet"
              description="Add your review using the button above."
            />
          )}
        </section>
        <details className="mt-3 text-xs text-muted">
          <summary className="cursor-pointer">How scores work</summary>
          <p className="mb-0 mt-2 max-w-xl leading-relaxed">
            Every meal gets its own entry. Each friend’s latest visit determines
            their current score and the group average.
          </p>
          <p className="mb-0 mt-2">
            Group agreement: {formatRating(summary.agreement)}. A smaller spread
            means our scores are closer together.
          </p>
        </details>
      </div>
      <div className="mb-5 mt-9 flex flex-wrap items-end justify-between gap-3">
        <h2 className="section-title">Visits</h2>
        <span className="muted text-xs">
          Every visit, including earlier scores
        </span>
      </div>
      <section className="panel">
        {history.length ? (
          <VisitList
            allVisits={journal.visits}
            visits={history}
            profiles={journal.profiles}
            restaurants={journal.restaurants}
            selectedProfileId={profile.id}
            controls
          />
        ) : (
          <EmptyState
            title="No visits yet"
            description="Log your first visit above."
          />
        )}
      </section>
    </>
  );
}
