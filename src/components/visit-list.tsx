import Link from "next/link";
import { Pencil } from "lucide-react";
import type { Journal } from "@/lib/data";
import { findProfile } from "@/config/profiles";
import { formatDate } from "@/lib/dates";
import { compareVisits, currentRatings } from "@/lib/ratings";
import { Avatar } from "./avatar";
import { DeleteVisit } from "./delete-visit";
import { Rating } from "./ui";

export function VisitList({
  visits,
  profiles,
  selectedProfileId,
  restaurants,
  showPlace = false,
  controls = false,
}: {
  visits: Journal["visits"];
  profiles: Journal["profiles"];
  selectedProfileId: string;
  restaurants: Journal["restaurants"];
  showPlace?: boolean;
  controls?: boolean;
}) {
  const currentIds = new Set(currentRatings(visits).map((visit) => visit.id));
  return (
    <div className="divide-y divide-line">
      {[...visits].sort(compareVisits).map((visit) => {
        const profile = findProfile(visit.profileId);
        const name =
          profiles.find((item) => item.id === visit.profileId)?.name ??
          "Former friend";
        const place = restaurants.find(
          (item) => item.id === visit.restaurantId,
        );
        return (
          <article
            id={`visit-${visit.id}`}
            key={visit.id}
            className="px-6 py-5"
          >
            <div className="flex items-start gap-3">
              {profile ? <Avatar profile={profile} size={36} /> : null}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold">{name}</span>
                  {currentIds.has(visit.id) && controls ? (
                    <span className="badge">Current score</span>
                  ) : null}
                  <time
                    dateTime={visit.visitDate}
                    className="ml-auto text-[11px] text-muted"
                  >
                    {formatDate(visit.visitDate)}
                  </time>
                </div>
                {showPlace && place ? (
                  <Link
                    href={`/places/${place.id}`}
                    className="mb-2 inline-block text-sm text-accent hover:underline"
                  >
                    {place.name}
                  </Link>
                ) : null}
                <div className="mb-2">
                  <Rating value={visit.rating} compact />
                </div>
                {visit.orderDescription ? (
                  <p className="mb-2 whitespace-pre-wrap break-words text-xs">
                    <span className="font-semibold">Ordered: </span>
                    {visit.orderDescription}
                  </p>
                ) : null}
                {visit.reviewText ? (
                  <p className="muted mb-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {visit.reviewText}
                  </p>
                ) : null}
                {visit.amountSpent !== null ? (
                  <p className="muted mb-1 text-xs">
                    ${visit.amountSpent} {visit.currency} per person
                  </p>
                ) : null}
                {controls && visit.profileId === selectedProfileId ? (
                  <div className="mt-2 flex items-center gap-2">
                    <Link
                      href={`/visits/${visit.id}/edit`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded px-2 text-xs text-accent hover:bg-[#f4e9db]"
                    >
                      <Pencil size={13} aria-hidden="true" />
                      Edit
                    </Link>
                    <DeleteVisit
                      id={visit.id}
                      date={formatDate(visit.visitDate)}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
