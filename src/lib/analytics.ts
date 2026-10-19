import Decimal from "decimal.js";
import type { Journal } from "./data";
import {
  currentRatings,
  meanRating,
  restaurantSummary,
  type RatingFilters,
} from "./ratings";

export type AnalyticsFilters = RatingFilters & { cuisine?: string };

export function buildAnalytics(journal: Journal, filters: AnalyticsFilters) {
  const places = journal.restaurants.filter(
    (place) =>
      (!filters.restaurantId || place.id === filters.restaurantId) &&
      (!filters.cuisine || place.cuisines.includes(filters.cuisine)),
  );
  const placeIds = new Set(places.map((place) => place.id));
  const placeById = new Map(places.map((place) => [place.id, place]));
  const allVisits = journal.visits.filter(
    (visit) =>
      placeIds.has(visit.restaurantId) &&
      (!filters.profileId || filters.profileId === visit.profileId),
  );
  const history = allVisits.filter(
    (visit) =>
      (!filters.start || visit.visitDate >= filters.start) &&
      (!filters.end || visit.visitDate <= filters.end),
  );
  const current = currentRatings(allVisits, filters);
  const leaderboard = places
    .flatMap((place) => {
      const summary = restaurantSummary(allVisits, place.id, filters);
      return summary.average === null
        ? []
        : [
            {
              id: place.id,
              name: place.name,
              average: summary.average.toString(),
              reviewerCount: summary.reviewerCount,
              visitCount: summary.visitCount,
              agreement: summary.agreement?.toString() ?? null,
            },
          ];
    })
    .sort(
      (a, b) =>
        new Decimal(b.average).cmp(a.average) || a.name.localeCompare(b.name),
    );

  // History averages every recorded visit on that date. It is deliberately
  // separate from current scores, where each reviewer has one vote per place.
  const dates = [...new Set(history.map((visit) => visit.visitDate))].sort();
  const timeline = dates.map((date) => {
    const rows = history.filter((visit) => visit.visitDate === date);
    return {
      date,
      average: meanRating(rows)?.toString() ?? null,
      visitCount: rows.length,
      reviewerCount: new Set(rows.map((visit) => visit.profileId)).size,
    };
  });

  const comparison = journal.profiles.flatMap((profile) => {
    const scores = current.filter((visit) => visit.profileId === profile.id);
    const average = meanRating(scores);
    return average === null
      ? []
      : [
          {
            name: profile.name,
            average: average.toString(),
            placeCount: scores.length,
            visitCount: history.filter(
              (visit) => visit.profileId === profile.id,
            ).length,
          },
        ];
  });

  const categories = [
    ...new Set(places.flatMap((place) => place.cuisines)),
  ].sort();
  const cuisines = categories
    .flatMap((name) => {
      const categoryPlaces = new Set(
        places
          .filter((place) => place.cuisines.includes(name))
          .map((place) => place.id),
      );
      const scores = current.filter((visit) =>
        categoryPlaces.has(visit.restaurantId),
      );
      const average = meanRating(scores);
      return average === null
        ? []
        : [
            {
              name,
              average: average.toString(),
              scoreCount: scores.length,
              reviewerCount: new Set(scores.map((visit) => visit.profileId))
                .size,
              visitCount: history.filter((visit) =>
                categoryPlaces.has(visit.restaurantId),
              ).length,
            },
          ];
    })
    .sort(
      (a, b) =>
        new Decimal(b.average).cmp(a.average) || a.name.localeCompare(b.name),
    );

  const recordedSpending = history.filter(
    (visit) => visit.amountSpent !== null,
  );
  const spendingTotal = recordedSpending.reduce(
    (sum, visit) => sum.plus(visit.amountSpent!),
    new Decimal(0),
  );
  return {
    leaderboard,
    timeline,
    comparison,
    cuisines,
    currentScoreCount: current.length,
    currentAverage: meanRating(current)?.toString() ?? null,
    reviewerCount: new Set(current.map((visit) => visit.profileId)).size,
    visitCount: history.length,
    recordedSpendingCount: recordedSpending.length,
    spendingTotal: recordedSpending.length ? spendingTotal.toFixed(2) : null,
    spendingAverage: recordedSpending.length
      ? spendingTotal.div(recordedSpending.length).toFixed(2)
      : null,
    history: history.map((visit) => ({
      ...visit,
      restaurantName: placeById.get(visit.restaurantId)!.name,
    })),
  };
}
