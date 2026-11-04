import Link from "next/link";
import {
  CircleCheck,
  Coffee,
  BookOpen,
  Plus,
  UtensilsCrossed,
} from "lucide-react";
import type { Restaurant } from "@/db/schema";
import { formatRating } from "@/lib/ratings";
import type Decimal from "decimal.js";
import { FoodDoodle } from "./food-doodle";
import { ratingMood } from "./rating-mood";
import { DeletePlaceButton } from "./delete-place-button";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="hieu’s reviews home">
      <span className="brand-mark">
        <FoodDoodle size={48} />
      </span>
      <span className="brand-title">hieu’s reviews</span>
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header mb-7 flex flex-wrap items-center justify-between gap-4">
      <div className="page-header-copy">
        <h1 className="display mb-0">{title}</h1>
        {description ? (
          <p className="muted mb-0 mt-2 max-w-2xl text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="page-header-actions">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="px-6 py-9 text-center">
      <FoodDoodle size={44} className="mx-auto mb-2" />
      <h2 className="section-title mb-2">{title}</h2>
      <p className="muted mx-auto mb-5 max-w-md text-sm">{description}</p>
      {href && action ? (
        <Link href={href} className="btn btn-secondary">
          <Plus size={15} aria-hidden="true" />
          {action}
        </Link>
      ) : null}
    </div>
  );
}

export function DatabaseSetup() {
  return (
    <div className="panel p-6">
      <BookOpen size={23} className="mb-4 text-accent" aria-hidden="true" />
      <h2 className="section-title mb-2">The journal isn’t ready just yet.</h2>
      <p className="muted mb-0 max-w-xl text-sm">
        Our places and reviews will appear here once the journal is connected.
        Please try again in a little while.
      </p>
    </div>
  );
}

export function StatusNotice({
  saved,
  error,
}: {
  saved?: string;
  error?: string;
}) {
  const messages: Record<string, string> = {
    place: "Place saved.",
    visit: "Review saved. Thanks for the hot take!",
    edit: "Visit updated.",
    delete: "Visit deleted. Ratings updated.",
  };
  if (saved && messages[saved])
    return (
      <p role="status" className="notice mb-6 flex items-start gap-2">
        <CircleCheck size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
        {messages[saved]}
      </p>
    );
  if (error)
    return (
      <p role="alert" className="notice notice-error mb-6">
        {error === "delete"
          ? "The visit couldn’t be deleted. Please try again."
          : "That visit is no longer available for this profile."}
      </p>
    );
  return null;
}

export function Rating({
  value,
  compact = false,
}: {
  value: Decimal | string | number | null;
  compact?: boolean;
}) {
  const mood = ratingMood(value?.toString());
  return (
    <span
      className={compact ? "font-semibold text-accent tabular-nums" : "score"}
      data-mood={mood.tone}
    >
      {formatRating(value)}
      {value !== null ? (
        <span className="ml-1 font-sans text-[11px] font-normal text-muted">
          / 10
        </span>
      ) : null}
    </span>
  );
}

export function PlaceCard({
  place,
  average,
  reviewerCount,
  visitCount,
  showRemove = false,
}: {
  place: Restaurant;
  average: Decimal | null;
  reviewerCount: number;
  visitCount: number;
  showRemove?: boolean;
}) {
  const Icon = place.kind === "cafe" ? Coffee : UtensilsCrossed;
  const mood = ratingMood(average?.toString() ?? null);
  return (
    <article
      className="panel place-card group relative text-ink"
      data-kind={place.kind}
      data-rating-tone={mood.tone}
    >
      {showRemove ? (
        <DeletePlaceButton
          id={place.id}
          name={place.name}
          visitCount={visitCount}
        />
      ) : null}
      <Link href={`/places/${place.id}`} className="block text-ink">
        <div className="mb-3 flex items-center">
          <span className="place-icon">
            <Icon size={22} strokeWidth={1.4} aria-hidden="true" />
          </span>
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <span className="text-[11px] text-muted">
            {place.kind === "cafe" ? "Café" : "Restaurant"}
          </span>
        </div>
        <h2 className="mb-2 text-[19px] font-semibold tracking-tight">
          {place.name}
        </h2>
        {place.address ? (
          <p className="muted mb-4 truncate text-xs">{place.address}</p>
        ) : null}
        <div className="mb-5 flex min-h-6 flex-wrap gap-1.5">
          {place.cuisines.slice(0, 3).map((cuisine) => (
            <span key={cuisine} className="badge">
              {cuisine}
            </span>
          ))}
          {place.priceTier ? (
            <span
              className="badge"
              aria-label={`Price tier ${place.priceTier} of 4`}
            >
              {"$".repeat(place.priceTier)}
            </span>
          ) : null}
        </div>
        <div className="flex items-end justify-between border-t border-line pt-4">
          <div>
            <p className="muted mb-0 text-[11px]">The group’s take</p>
            <Rating value={average} />
          </div>
          <p className="muted mb-1 text-right text-[10px]">
            {reviewerCount} {reviewerCount === 1 ? "reviewer" : "reviewers"}
            <br />
            {visitCount} {visitCount === 1 ? "visit" : "visits"}
          </p>
        </div>
      </Link>
    </article>
  );
}
