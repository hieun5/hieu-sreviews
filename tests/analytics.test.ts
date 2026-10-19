import { describe, expect, it } from "vitest";
import { buildAnalytics } from "../src/lib/analytics";
import { journalFixture, placeB, visit } from "./fixtures";

describe("server-side analytics", () => {
  const journal = journalFixture([
    visit({ id: "jan", rating: "2", amountSpent: null }),
    visit({
      id: "feb",
      rating: "10",
      visitDate: "2025-02-01",
      amountSpent: "0.00",
    }),
    visit({
      id: "nick",
      profileId: "nick",
      rating: "6",
      visitDate: "2025-02-01",
      amountSpent: "0.10",
    }),
    visit({
      id: "other",
      restaurantId: placeB,
      rating: "9",
      visitDate: "2025-02-02",
      amountSpent: "0.20",
    }),
  ]);
  it("builds current leaderboards and cuisine preferences from one score per reviewer/place", () => {
    const data = buildAnalytics(journal, {});
    expect(data.leaderboard.map((row) => row.average)).toEqual(["9", "8"]);
    expect(data.leaderboard[1]).toMatchObject({
      reviewerCount: 2,
      visitCount: 3,
      agreement: "2",
    });
    expect(data.cuisines.find((row) => row.name === "Coffee")?.average).toBe(
      "8",
    );
    expect(data.comparison.find((row) => row.name === "Hieu")?.average).toBe(
      "9.5",
    );
  });
  it("keeps historical timeline metrics separate from current ratings", () => {
    const data = buildAnalytics(journal, {});
    expect(
      data.timeline.find((row) => row.date === "2025-01-01")?.average,
    ).toBe("2");
    expect(
      data.timeline.find((row) => row.date === "2025-02-01"),
    ).toMatchObject({ average: "8", visitCount: 2, reviewerCount: 2 });
    expect(data.visitCount).toBe(4);
    expect(data.currentScoreCount).toBe(3);
  });
  it("applies profile, cuisine, restaurant, and date filters on the server", () => {
    const data = buildAnalytics(journal, {
      profileId: "hieu",
      cuisine: "Coffee",
      start: "2025-01-01",
      end: "2025-01-31",
    });
    expect(data.leaderboard.map((row) => row.average)).toEqual(["2"]);
    expect(data.visitCount).toBe(1);
    expect(buildAnalytics(journal, { restaurantId: placeB }).visitCount).toBe(
      1,
    );
  });
  it("sums recorded decimal spending exactly and includes zero without inventing missing spending", () => {
    const data = buildAnalytics(journal, {});
    expect(data.spendingTotal).toBe("0.30");
    expect(data.recordedSpendingCount).toBe(3);
    expect(data.spendingAverage).toBe("0.10");
    expect(
      buildAnalytics(journal, { end: "2025-01-31" }).spendingTotal,
    ).toBeNull();
  });
  it("returns missing values and empty arrays for an empty journal", () => {
    const data = buildAnalytics(journalFixture([]), {});
    expect(data.currentAverage).toBeNull();
    expect(data.spendingAverage).toBeNull();
    expect(data.leaderboard).toEqual([]);
    expect(data.timeline).toEqual([]);
    expect(data.comparison).toEqual([]);
    expect(data.cuisines).toEqual([]);
  });
});
