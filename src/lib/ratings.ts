import Decimal from "decimal.js";

// Ratings accept up to 32 input characters. Preserve precision near display
// rounding boundaries instead of rounding an intermediate sum or average.
const RatingDecimal = Decimal.clone({ precision: 80 });

// All current-rating selection and aggregation lives here. Never persist averages.
export type RatedVisit = {
  id: string;
  restaurantId: string;
  profileId: string;
  rating: string | null;
  visitDate: string;
  createdAt: string;
};

export type RatingFilters = {
  start?: string;
  end?: string;
  profileId?: string;
  restaurantId?: string;
};

function creationInstant(value: string): bigint {
  // JS Date keeps milliseconds; PostgreSQL timestamps also retain microseconds.
  // Preserve fractional digits when two visits share the same millisecond.
  const fraction = value.match(/[T ]\d{2}:\d{2}:\d{2}\.(\d+)/)?.[1] ?? "";
  const subMillisecond = fraction.padEnd(9, "0").slice(3, 9);
  return (
    BigInt(new Date(value).getTime()) * 1_000_000n + BigInt(subMillisecond)
  );
}

export function compareVisits(a: RatedVisit, b: RatedVisit): number {
  const dateOrder = b.visitDate.localeCompare(a.visitDate);
  if (dateOrder) return dateOrder;
  const createdA = creationInstant(a.createdAt);
  const createdB = creationInstant(b.createdAt);
  const createdOrder = createdA === createdB ? 0 : createdA > createdB ? -1 : 1;
  return createdOrder || b.id.localeCompare(a.id);
}

export function currentRatings<T extends RatedVisit>(
  visits: readonly T[],
  filters: RatingFilters = {},
): T[] {
  const latest = new Map<string, T>();
  for (const visit of visits) {
    if (filters.end && visit.visitDate > filters.end) continue;
    if (filters.profileId && visit.profileId !== filters.profileId) continue;
    if (filters.restaurantId && visit.restaurantId !== filters.restaurantId)
      continue;
    const key = `${visit.restaurantId}:${visit.profileId}`;
    const previous = latest.get(key);
    if (!previous || compareVisits(visit, previous) < 0) latest.set(key, visit);
  }
  // Apply the start date AFTER selecting the latest visit as of the end date.
  return [...latest.values()].filter(
    (visit) =>
      (!filters.start || visit.visitDate >= filters.start) &&
      visit.rating !== null,
  );
}

export function meanRating(
  visits: readonly Pick<RatedVisit, "rating">[],
): Decimal | null {
  const values = visits.flatMap((visit) =>
    visit.rating === null ? [] : [new RatingDecimal(visit.rating)],
  );
  return values.length
    ? values
        .reduce((sum, value) => sum.plus(value), new RatingDecimal(0))
        .div(values.length)
    : null;
}

export function populationStdDev(
  visits: readonly Pick<RatedVisit, "rating">[],
): Decimal | null {
  const values = visits.filter((visit) => visit.rating !== null);
  if (values.length < 2) return null;
  const mean = meanRating(values)!;
  return values
    .reduce(
      (sum, visit) =>
        sum.plus(new RatingDecimal(visit.rating!).minus(mean).pow(2)),
      new RatingDecimal(0),
    )
    .div(values.length)
    .sqrt();
}

export function restaurantSummary<T extends RatedVisit>(
  visits: readonly T[],
  restaurantId: string,
  filters: RatingFilters = {},
) {
  const history = visits.filter(
    (visit) =>
      visit.restaurantId === restaurantId &&
      (!filters.profileId || visit.profileId === filters.profileId) &&
      (!filters.start || visit.visitDate >= filters.start) &&
      (!filters.end || visit.visitDate <= filters.end),
  );
  const scores = currentRatings(visits, { ...filters, restaurantId });
  return {
    scores,
    average: meanRating(scores),
    reviewerCount: scores.length,
    visitCount: history.length,
    agreement: populationStdDev(scores),
  };
}

export function formatRating(
  value: Decimal | string | number | null | undefined,
): string {
  return value === null || value === undefined
    ? "—"
    : new RatingDecimal(value).toFixed(1);
}
