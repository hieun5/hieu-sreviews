import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Coffee, MapPin, Plus, UtensilsCrossed } from "lucide-react";
import { z } from "zod";
import { Avatar } from "@/components/avatar";
import {
  DatabaseSetup,
  EmptyState,
  Rating,
  StatusNotice,
} from "@/components/ui";
import { VisitList } from "@/components/visit-list";
import { ReviewSummaryPanel } from "@/components/review-summary-panel";
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
        className="mb-6 inline-flex items-center gap-2 text-xs text-accent"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        All places
      </Link>
      <StatusNotice saved={query.saved} error={query.error} />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="place-icon">
              <Icon size={24} strokeWidth={1.3} aria-hidden="true" />
            </span>
            <span className="text-xs text-muted">
              {place.kind === "cafe" ? "Café" : "Restaurant"}
            </span>
          </div>
          <h1 className="display mb-3 text-[clamp(28px,3vw,36px)]">
            {place.name}
          </h1>
          <p className="muted mb-4 flex items-center gap-2 text-sm">
            <MapPin size={15} aria-hidden="true" />
            {place.address}
          </p>
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
          <Plus size={16} aria-hidden="true" />
          Log a visit
        </Link>
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
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
          <p className="muted mb-3 text-xs">Your current score</p>
          <Rating
            value={
              summary.scores.find((visit) => visit.profileId === profile.id)
                ?.rating ?? null
            }
          />
          <p className="muted mb-0 mt-2 text-xs">
            {history.filter((visit) => visit.profileId === profile.id).length}{" "}
            visits from {profile.name}
          </p>
        </div>
        <div className="panel p-6">
          <p className="muted mb-3 text-xs">Group agreement</p>
          <p className="stat-value mb-0">
            {formatRating(summary.agreement)}
            <span className="ml-2 font-sans text-xs text-muted">σ</span>
          </p>
          <p className="muted mb-0 mt-2 text-xs">
            {summary.reviewerCount >= 2
              ? "Population deviation · lower = more agreement"
              : "Needs at least two reviewers"}
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
                    <div className="flex-1">
                      <p className="mb-0 text-sm font-semibold">
                        {friend.name}
                      </p>
                      <p className="muted mb-0 text-[11px]">
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
              description="Log a visit to add yours."
              href={`/places/${id}/visits/new`}
              action="Log a visit"
            />
          )}
        </section>
        <details className="mt-3 text-xs text-muted">
          <summary className="cursor-pointer">How scores work</summary>
          <p className="mb-0 mt-2 max-w-xl leading-relaxed">
            Each return visit is a new entry. Only your latest visit determines
            your current score. Visit date comes first, then creation time, then
            the visit’s unique ID to break a tie.
          </p>
        </details>
      </div>
      <ReviewSummaryPanel
        restaurantId={id}
        reviews={history
          .filter((visit) => visit.reviewText?.trim())
          .map(({ id: visitId, profileId, visitDate }) => ({
            id: visitId,
            profileId,
            visitDate,
          }))}
        profileNames={Object.fromEntries(
          journal.profiles.map(({ id: profileId, name }) => [profileId, name]),
        )}
      />
      <div className="mb-5 mt-9 flex flex-wrap items-end justify-between gap-3">
        <h2 className="section-title">Visits</h2>
        <span className="muted text-[11px]">
          Every visit, including earlier scores
        </span>
      </div>
      <section className="panel">
        {history.length ? (
          <VisitList
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
