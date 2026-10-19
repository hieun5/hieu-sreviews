import Decimal from "decimal.js";
import type {
  Restaurant as RestaurantRow,
  Visit as VisitRow,
} from "@/db/schema";
import { restaurantSummary } from "@/lib/ratings";

// Preserve PostgreSQL fractional seconds for clients that compare visit times.
export function isoTimestamp(value: string) {
  const iso = value
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00")
    .replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  return iso.replace(/\+00:00$/, "Z");
}

export function centsToDollars(value: number | null) {
  return value === null ? null : new Decimal(value).div(100).toFixed(2);
}

export function dollarsToCents(value: string | null) {
  return value === null ? null : new Decimal(value).mul(100).toNumber();
}

export function serializeVisit(visit: VisitRow) {
  const { amountSpent, ...rest } = visit;
  return {
    ...rest,
    rating: Number(visit.rating),
    amountSpentCents: dollarsToCents(amountSpent),
    createdAt: isoTimestamp(visit.createdAt),
    updatedAt: isoTimestamp(visit.updatedAt),
  };
}

export function serializeRestaurant(place: RestaurantRow, history: VisitRow[]) {
  const {
    id,
    name,
    address,
    kind,
    cuisines,
    priceTier,
    provider,
    providerPlaceId,
  } = place;
  const summary = restaurantSummary(history, place.id);
  return {
    id,
    name,
    address,
    kind,
    cuisines,
    priceTier,
    provider,
    providerPlaceId,
    createdAt: isoTimestamp(place.createdAt),
    currentRating: {
      average: summary.average?.toString() ?? null,
      agreement: summary.agreement?.toString() ?? null,
      reviewerCount: summary.reviewerCount,
      visitCount: summary.visitCount,
      scores: summary.scores
        .sort((a, b) => a.profileId.localeCompare(b.profileId))
        .map((visit) => ({
          profileId: visit.profileId,
          visitId: visit.id,
          rating: Number(visit.rating),
          visitDate: visit.visitDate,
        })),
    },
  };
}
