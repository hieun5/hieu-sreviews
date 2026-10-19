import { describe, expect, it } from "vitest";
import {
  compareVisits,
  currentRatings,
  formatRating,
  meanRating,
  populationStdDev,
  restaurantSummary,
} from "../src/lib/ratings";
import { placeA, placeB, visit } from "./fixtures";

describe("the current-rating contract", () => {
  it("uses visit date ahead of when a backdated visit was created", () => {
    const latest = visit({
      id: "latest",
      visitDate: "2025-02-01",
      createdAt: "2025-02-01T00:00:00Z",
      rating: "9",
    });
    const backdated = visit({
      id: "backdated",
      visitDate: "2025-01-01",
      createdAt: "2025-03-01T00:00:00Z",
      rating: "4",
    });
    expect(currentRatings([backdated, latest])).toEqual([latest]);
  });
  it("breaks same-date ties by the instant of creation, then stable ID", () => {
    const first = visit({ id: "a", createdAt: "2025-01-01T18:00:00Z" });
    const second = visit({ id: "b", createdAt: "2025-01-01T11:00:00-08:00" });
    const third = visit({ id: "c", createdAt: "2025-01-01T19:00:00Z" });
    expect(currentRatings([third, first, second])[0].id).toBe("c");
    expect(compareVisits(second, first)).toBeLessThan(0);
    expect(currentRatings([second, first, third])[0].id).toBe("c");
  });
  it("keeps separate reviewer/restaurant pairs and gives each reviewer one vote", () => {
    const rows = [
      visit({ id: "old", rating: "2" }),
      visit({ id: "return", rating: "10", visitDate: "2025-02-01" }),
      visit({ id: "friend", profileId: "nick", rating: "6" }),
      visit({ id: "other", restaurantId: placeB, rating: "3" }),
    ];
    const result = restaurantSummary(rows, placeA);
    expect(result.average?.toString()).toBe("8");
    expect(result.reviewerCount).toBe(2);
    expect(result.visitCount).toBe(3);
    expect(currentRatings(rows)).toHaveLength(3);
  });
  it("retains PostgreSQL microsecond precision before applying the ID tie breaker", () => {
    const earlier = visit({
      id: "z",
      createdAt: "2025-01-01T18:00:00.123111Z",
    });
    const later = visit({ id: "a", createdAt: "2025-01-01T18:00:00.123999Z" });
    expect(currentRatings([earlier, later])[0].id).toBe("a");
  });
  it("reveals the earlier score after the newest visit is deleted", () => {
    const rows = [
      visit({ id: "old", rating: "6" }),
      visit({ id: "new", rating: "10", visitDate: "2025-02-01" }),
      visit({ id: "friend", profileId: "nick", rating: "8" }),
    ];
    expect(restaurantSummary(rows, placeA).average?.toString()).toBe("9");
    expect(
      restaurantSummary(
        rows.filter((row) => row.id !== "new"),
        placeA,
      ).average?.toString(),
    ).toBe("7");
    expect(restaurantSummary([], placeA).average).toBeNull();
  });
  it("does not turn missing ratings or absent reviewers into zero", () => {
    expect(meanRating([{ rating: "9" }, { rating: null }])?.toString()).toBe(
      "9",
    );
    expect(meanRating([{ rating: null }])).toBeNull();
    expect(currentRatings([{ ...visit(), rating: null }])).toEqual([]);
    const rows = [
      visit({ id: "earlier", rating: "8" }),
      { ...visit({ id: "latest", visitDate: "2025-02-01" }), rating: null },
    ];
    expect(currentRatings(rows)).toEqual([]);
  });
  it("selects as of the end date before applying the start date", () => {
    const rows = [
      visit({ id: "jan" }),
      visit({ id: "feb", visitDate: "2025-02-01" }),
      visit({ id: "mar", visitDate: "2025-03-01" }),
    ];
    expect(
      currentRatings(rows, { start: "2025-01-15", end: "2025-02-20" }).map(
        (row) => row.id,
      ),
    ).toEqual(["feb"]);
    expect(
      currentRatings(rows, { start: "2025-02-02", end: "2025-02-20" }),
    ).toEqual([]);
    expect(
      currentRatings(rows, { start: "2024-12-01", end: "2024-12-31" }),
    ).toEqual([]);
  });
  it("filters by profile and restaurant without mutating history", () => {
    const rows = [
      visit(),
      visit({ id: "other", profileId: "nick", restaurantId: placeB }),
    ];
    expect(
      currentRatings(rows, { profileId: "nick", restaurantId: placeA }),
    ).toEqual([]);
    expect(rows).toHaveLength(2);
  });
  it("uses population deviation and requires two recorded ratings", () => {
    expect(
      populationStdDev([{ rating: "6" }, { rating: "10" }])?.toString(),
    ).toBe("2");
    expect(populationStdDev([{ rating: "6" }, { rating: null }])).toBeNull();
    expect(
      populationStdDev([{ rating: "6" }, { rating: "6" }])?.toString(),
    ).toBe("0");
  });
  it("rounds only the final displayed score", () => {
    const average = meanRating([{ rating: "8.04" }, { rating: "8.05" }]);
    expect(average?.toString()).toBe("8.045");
    expect(formatRating(average)).toBe("8.0");
    expect(formatRating(null)).toBe("—");
  });
  it("does not cross a one-decimal rounding boundary during intermediate arithmetic", () => {
    const exact = "8.94999999999999999999999999999";
    const average = meanRating([{ rating: exact }, { rating: exact }]);
    expect(average?.toString()).toBe(exact);
    expect(formatRating(average)).toBe("8.9");
  });
});
