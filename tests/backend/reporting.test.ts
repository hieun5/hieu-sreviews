import { PGlite } from "@electric-sql/pglite";
import Decimal from "decimal.js";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  analyticsResponseSchema,
  dashboardResponseSchema,
  reportSemantics,
} from "../../src/contracts/reporting";
import { apiErrorSchema } from "../../src/contracts/journal";
import * as schema from "../../src/db/schema";
import { seedProfiles } from "../../src/db/seed-profiles";
import { buildAnalytics } from "../../src/lib/analytics";
import { formatRating } from "../../src/lib/ratings";
import { createReportingRepository } from "../../src/server/reporting-repository";
import { createReportingApi } from "../../src/server/reporting-api";
import { createJournalRepository } from "../../src/server/journal-repository";

const client = new PGlite();
const db = drizzle(client, { schema });
const repository = createReportingRepository(db);
let selected: string | undefined = "hieu";
const reportError = vi.fn();
const api = createReportingApi({
  repository: () => repository,
  selectedProfile: async () => selected,
  today: () => "2026-10-18",
  timeZone: () => "America/Los_Angeles",
  reportError,
});
const placeA = "10000000-0000-4000-8000-000000000001";
const placeB = "10000000-0000-4000-8000-000000000002";
const placeC = "10000000-0000-4000-8000-000000000003";
const ids = [1, 2, 3, 4, 5, 6].map(
  (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
);
const request = (endpoint: string, query = "") =>
  new Request(`http://localhost/api/${endpoint}${query ? `?${query}` : ""}`);

async function analytics(query = "") {
  const response = await api.analytics(request("analytics", query));
  const body: unknown = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  return analyticsResponseSchema.parse(body).data;
}
async function dashboard(query = "") {
  const response = await api.dashboard(request("dashboard", query));
  const body: unknown = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(200);
  return dashboardResponseSchema.parse(body).data;
}
async function error(
  endpoint: "dashboard" | "analytics",
  query: string,
  status: number,
  code: string,
) {
  const response = await api[endpoint](request(endpoint, query));
  expect(response.status).toBe(status);
  const body = apiErrorSchema.parse(await response.json());
  expect(body.error.code).toBe(code);
}
function sameDecimal(actual: string | null, expected: string | null) {
  if (expected === null) expect(actual).toBeNull();
  else
    expect(new Decimal(actual!).minus(expected).abs().lte("1e-70")).toBe(true);
}

async function fixture() {
  await db.insert(schema.restaurants).values([
    {
      id: placeA,
      name: "Cafe Moon",
      address: "A street",
      kind: "cafe",
      cuisines: ["Coffee", "Brunch", "Coffee"],
      normalizedName: "cafe moon",
      normalizedAddress: "a street",
    },
    {
      id: placeB,
      name: "Noodle Bar",
      address: "B street",
      kind: "restaurant",
      cuisines: ["Vietnamese", "Brunch"],
      normalizedName: "noodle bar",
      normalizedAddress: "b street",
    },
    {
      id: placeC,
      name: "Unreviewed Bakery",
      address: "C street",
      kind: "cafe",
      cuisines: ["Dessert"],
      normalizedName: "unreviewed bakery",
      normalizedAddress: "c street",
    },
  ]);
  await db.insert(schema.visits).values([
    {
      id: ids[0],
      restaurantId: placeA,
      profileId: "hieu",
      rating: "2",
      visitDate: "2025-01-01",
      createdAt: "2025-01-01T18:00:00Z",
      amountSpent: null,
    },
    {
      id: ids[1],
      restaurantId: placeA,
      profileId: "hieu",
      rating: "10",
      visitDate: "2025-02-01",
      createdAt: "2025-02-01T18:00:00Z",
      amountSpent: "0.00",
    },
    {
      id: ids[2],
      restaurantId: placeA,
      profileId: "nick",
      rating: "6",
      visitDate: "2025-02-01",
      createdAt: "2025-02-01T19:00:00Z",
      amountSpent: "0.10",
    },
    {
      id: ids[3],
      restaurantId: placeB,
      profileId: "hieu",
      rating: "9",
      visitDate: "2025-02-02",
      createdAt: "2025-02-02T18:00:00Z",
      amountSpent: "0.20",
    },
  ]);
}

async function recommendationActivityFixture() {
  const runId = "30000000-0000-4000-8000-000000000001";
  const resultId = "40000000-0000-4000-8000-000000000001";
  await db.insert(schema.recommendationRuns).values({
    id: runId,
    requestId: "50000000-0000-4000-8000-000000000001",
    requestHash: "a".repeat(64),
    createdBy: "hieu",
    mode: "favorites",
    status: "completed",
    algorithmVersion: "recommendations-v1",
    filters: {
      cuisine: null,
      kind: null,
      maxPriceTier: null,
      maxDistanceMeters: null,
      openNowOnly: false,
    },
    resultLimit: 1,
    createdAt: "2025-02-01T12:00:00Z",
    completedAt: "2025-02-01T12:00:01Z",
  });
  await db.insert(schema.recommendationAttendees).values([
    { runId, profileId: "hieu" },
    { runId, profileId: "nick" },
  ]);
  await db.insert(schema.recommendationResults).values({
    id: resultId,
    runId,
    rank: 1,
    restaurantId: placeA,
    preferenceScore: "80",
    metrics: {
      coverage: "1",
      observedMean: "8",
      disagreement: "2",
      cuisineAffinity: null,
      ratedAttendeeCount: 2,
      preferenceAttendeeCount: 0,
      coldStartAttendeeCount: 0,
      metadataKnownCount: 0,
    },
    explanations: [],
  });
  await db.insert(schema.recommendationFeedback).values([
    { runId, profileId: "hieu", resultId, choice: "selected" },
    { runId, profileId: "nick", resultId, choice: "dismissed" },
  ]);
  await db.insert(schema.recommendationVisitLinks).values({
    id: "60000000-0000-4000-8000-000000000001",
    runId,
    profileId: "hieu",
    resultId,
    visitId: ids[1],
    createdAt: "2025-02-01T18:30:00Z",
  });
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});
afterAll(async () => {
  await client.close();
});
beforeEach(async () => {
  await db.delete(schema.visits);
  await db.delete(schema.recommendationRuns);
  await db.execute(sql`alter table visits alter column rating set not null`);
  await db.delete(schema.restaurants);
  await db.delete(schema.profiles);
  await seedProfiles(db);
  selected = "hieu";
  reportError.mockReset();
});

describe("dashboard SQL with real PostgreSQL fixtures", () => {
  it("returns recent group visits, unique personal places, distinct counts and honest limits", async () => {
    await fixture();
    const data = await dashboard("recentLimit=1");
    expect(data.counts).toEqual({
      savedRestaurantCount: 3,
      visitedRestaurantCount: 2,
      historicalVisitCount: 4,
      historicalReviewerCount: 2,
      currentScoreCount: 3,
      currentReviewerCount: 2,
      currentlyRatedRestaurantCount: 2,
      personalVisitCount: 3,
      personalVisitedRestaurantCount: 2,
    });
    expect(data.recentVisits).toMatchObject({
      limit: 1,
      total: 4,
      hasMore: true,
    });
    expect(data.recentVisits.data[0]).toMatchObject({
      id: ids[3],
      restaurant: { id: placeB, name: "Noodle Bar" },
      profile: { id: "hieu", name: "Hieu" },
      amountSpentCents: 20,
    });
    expect(data.recentlyReviewedPlaces).toMatchObject({
      limit: 1,
      total: 2,
      hasMore: true,
    });
    const complete = await dashboard();
    expect(
      complete.recentlyReviewedPlaces.data.map((row) => row.restaurant.id),
    ).toEqual([placeB, placeA]);
    expect(complete.recentlyReviewedPlaces.data[1]).toMatchObject({
      latestVisit: { id: ids[1], rating: 10 },
      currentRating: {
        average: "8",
        reviewerCount: 2,
        visitCount: 3,
        agreement: "2",
      },
    });
    expect(complete.meta).toMatchObject({
      filters: { view: "group", profileId: null },
      selectedProfileId: "hieu",
      personalProfileId: "hieu",
      semantics: reportSemantics,
      timeZone: "America/Los_Angeles",
      today: "2026-10-18",
    });
  });

  it("defaults personal scope to the selected cookie and supports viewing another seeded friend", async () => {
    await fixture();
    const hieu = await dashboard("view=personal");
    expect(hieu.counts.historicalVisitCount).toBe(3);
    expect(hieu.currentAverage).toBe("9.5");
    expect(
      hieu.recentVisits.data.every((row) => row.profileId === "hieu"),
    ).toBe(true);
    const nick = await dashboard("view=personal&profileId=nick");
    expect(nick.meta.personalProfileId).toBe("nick");
    expect(nick.counts.historicalVisitCount).toBe(1);
    expect(nick.recentlyReviewedPlaces.data).toHaveLength(1);
    expect(nick.recentlyReviewedPlaces.data[0].latestVisit.profileId).toBe(
      "nick",
    );
    expect(nick.currentAverage).toBe("6");
  });

  it("applies end-as-of then start to personal recent places, and inclusive dates to recent history", async () => {
    await fixture();
    const january = await dashboard("end=2025-01-31");
    expect(january.recentlyReviewedPlaces.data[0].latestVisit.id).toBe(ids[0]);
    expect(january.currentAverage).toBe("2");
    const february = await dashboard("start=2025-02-01&end=2025-02-01");
    expect(february.recentVisits.total).toBe(2);
    expect(
      february.recentlyReviewedPlaces.data.map((row) => row.restaurant.id),
    ).toEqual([placeA]);
    expect(february.currentAverage).toBe("8");
    const none = await dashboard("start=2025-01-02&end=2025-01-31");
    expect(none.recentlyReviewedPlaces.total).toBe(0);
    expect(none.currentAverage).toBeNull();
    expect(none.counts.savedRestaurantCount).toBe(3);
  });

  it("uses exact cuisine and restaurant filters together without multiplying rows", async () => {
    await fixture();
    const result = await dashboard(`restaurantId=${placeA}&cuisine=Coffee`);
    expect(result.counts.savedRestaurantCount).toBe(1);
    expect(result.recentVisits.total).toBe(3);
    expect(result.recentlyReviewedPlaces.total).toBe(1);
    expect(
      (await dashboard(`restaurantId=${placeB}&cuisine=Coffee`)).counts
        .historicalVisitCount,
    ).toBe(0);
  });
});

describe("analytics SQL aggregates and parity with the shared rating contract", () => {
  it("reports recommendation selections and linked visits using shared personal and date filters", async () => {
    await fixture();
    await recommendationActivityFixture();
    expect((await analytics()).recommendationActivity).toEqual({
      selectedCount: 1,
      dismissedCount: 1,
      linkedSelectionCount: 1,
      linkedVisitCount: 1,
      linkedProfileCount: 1,
      linkedSelectionRatePercent: "100.00",
    });
    expect(
      (
        await analytics(
          `view=personal&profileId=nick&restaurantId=${placeA}&cuisine=Coffee&start=2025-02-01&end=2025-02-01`,
        )
      ).recommendationActivity,
    ).toEqual({
      selectedCount: 0,
      dismissedCount: 1,
      linkedSelectionCount: 0,
      linkedVisitCount: 0,
      linkedProfileCount: 0,
      linkedSelectionRatePercent: null,
    });
    expect(
      (await analytics("start=2025-02-02")).recommendationActivity,
    ).toEqual({
      selectedCount: 0,
      dismissedCount: 0,
      linkedSelectionCount: 0,
      linkedVisitCount: 0,
      linkedProfileCount: 0,
      linkedSelectionRatePercent: null,
    });
    expect(
      (await analytics(`restaurantId=${placeB}`)).recommendationActivity
        .selectedCount,
    ).toBe(0);
  });

  it("weights one current score per person/place and reports independent historical counts", async () => {
    await fixture();
    const result = await analytics();
    expect(result.leaderboard).toEqual([
      {
        id: placeB,
        name: "Noodle Bar",
        average: "9",
        agreement: null,
        reviewerCount: 1,
        visitCount: 1,
      },
      {
        id: placeA,
        name: "Cafe Moon",
        average: "8",
        agreement: "2",
        reviewerCount: 2,
        visitCount: 3,
      },
    ]);
    expect(result.timeline).toEqual([
      {
        date: "2025-01-01",
        average: "2",
        visitCount: 1,
        ratedVisitCount: 1,
        reviewerCount: 1,
        restaurantCount: 1,
      },
      {
        date: "2025-02-01",
        average: "8",
        visitCount: 2,
        ratedVisitCount: 2,
        reviewerCount: 2,
        restaurantCount: 1,
      },
      {
        date: "2025-02-02",
        average: "9",
        visitCount: 1,
        ratedVisitCount: 1,
        reviewerCount: 1,
        restaurantCount: 1,
      },
    ]);
    expect(
      result.comparison.find((row) => row.profileId === "hieu"),
    ).toMatchObject({ average: "9.5", placeCount: 2, visitCount: 3 });
    expect(
      result.comparison.find((row) => row.profileId === "nick"),
    ).toMatchObject({ average: "6", placeCount: 1, visitCount: 1 });
    expect(
      result.comparison.find((row) => row.profileId === "vinh"),
    ).toMatchObject({ average: null, placeCount: 0, visitCount: 0 });
    expect(result.spending).toEqual({
      currency: "USD",
      recordedVisitCount: 3,
      totalCents: 30,
      averageCents: 10,
      averageRounding: "nearest-cent-half-up",
    });
  });

  it("deduplicates repeated cuisine tags and isolates category joins from other metrics", async () => {
    await fixture();
    const result = await analytics();
    expect(result.cuisines.find((row) => row.name === "Coffee")).toEqual({
      name: "Coffee",
      average: "8",
      scoreCount: 2,
      reviewerCount: 2,
      restaurantCount: 1,
      visitCount: 3,
    });
    const brunch = result.cuisines.find((row) => row.name === "Brunch")!;
    expect(brunch).toMatchObject({
      scoreCount: 3,
      reviewerCount: 2,
      restaurantCount: 2,
      visitCount: 4,
    });
    sameDecimal(brunch.average, result.currentAverage);
    expect(result.cuisines.find((row) => row.name === "Dessert")).toEqual({
      name: "Dessert",
      average: null,
      scoreCount: 0,
      reviewerCount: 0,
      restaurantCount: 0,
      visitCount: 0,
    });
    expect(result.counts.historicalVisitCount).toBe(4);
    expect(result.filterOptions.cuisines).toEqual([
      "Brunch",
      "Coffee",
      "Dessert",
      "Vietnamese",
    ]);
  });

  it.each([
    "",
    "end=2025-01-31",
    "start=2025-02-01&end=2025-02-01",
    "view=personal",
    "view=personal&profileId=nick",
    "cuisine=Coffee",
    `restaurantId=${placeB}`,
    `restaurantId=${placeA}&cuisine=Coffee&start=2025-02-01&end=2025-02-01`,
  ])("matches existing shared calculations for %s", async (query) => {
    await fixture();
    const result = await analytics(query);
    const journal = {
      restaurants: await db.select().from(schema.restaurants),
      visits: await db.select().from(schema.visits),
      profiles: await db.select().from(schema.profiles),
    };
    const f = result.meta.filters;
    const expected = buildAnalytics(journal, {
      profileId: f.profileId ?? undefined,
      restaurantId: f.restaurantId ?? undefined,
      cuisine: f.cuisine ?? undefined,
      start: f.start ?? undefined,
      end: f.end ?? undefined,
    });
    sameDecimal(result.currentAverage, expected.currentAverage);
    expect(result.counts.currentScoreCount).toBe(expected.currentScoreCount);
    expect(result.counts.historicalVisitCount).toBe(expected.visitCount);
    expect(result.leaderboard.map((row) => row.id)).toEqual(
      expected.leaderboard.map((row) => row.id),
    );
    for (const row of expected.leaderboard) {
      const actual = result.leaderboard.find((value) => value.id === row.id)!;
      sameDecimal(actual.average, row.average);
      sameDecimal(actual.agreement, row.agreement);
      expect(actual.reviewerCount).toBe(row.reviewerCount);
      expect(actual.visitCount).toBe(row.visitCount);
    }
    for (const row of expected.cuisines)
      sameDecimal(
        result.cuisines.find((value) => value.name === row.name)!.average,
        row.average,
      );
  });

  it("breaks date ties by microsecond creation instant then stable ID, and restores deletion fallback", async () => {
    await fixture();
    await db.insert(schema.visits).values([
      {
        id: ids[4],
        restaurantId: placeA,
        profileId: "hieu",
        rating: "7",
        visitDate: "2025-02-01",
        createdAt: "2025-02-01T18:00:00.123999Z",
      },
      {
        id: ids[5],
        restaurantId: placeA,
        profileId: "hieu",
        rating: "9",
        visitDate: "2025-02-01",
        createdAt: "2025-02-01T18:00:00.123999Z",
      },
    ]);
    expect(
      (await analytics()).leaderboard.find((row) => row.id === placeA)?.average,
    ).toBe("7.5");
    expect(
      (await analytics()).timeline.find((row) => row.date === "2025-02-01"),
    ).toMatchObject({
      average: "8",
      visitCount: 4,
      ratedVisitCount: 4,
      reviewerCount: 2,
    });
    expect(
      (await dashboard()).recentlyReviewedPlaces.data.find(
        (row) => row.restaurant.id === placeA,
      )?.latestVisit.id,
    ).toBe(ids[5]);
    await createJournalRepository(db).deleteVisit(ids[5], "hieu");
    expect(
      (await analytics()).leaderboard.find((row) => row.id === placeA)?.average,
    ).toBe("6.5");
    await createJournalRepository(db).deleteVisit(ids[4], "hieu");
    await createJournalRepository(db).deleteVisit(ids[1], "hieu");
    expect(
      (await analytics()).leaderboard.find((row) => row.id === placeA)?.average,
    ).toBe("4");
  });

  it("prioritizes microsecond instants over a higher ID and visit date over a later-created backdate", async () => {
    await fixture();
    await db.insert(schema.visits).values([
      {
        id: ids[5],
        restaurantId: placeA,
        profileId: "hieu",
        rating: "1",
        visitDate: "2025-02-01",
        createdAt: "2025-02-01T18:00:00.123111Z",
      },
      {
        id: ids[4],
        restaurantId: placeA,
        profileId: "hieu",
        rating: "7",
        visitDate: "2025-02-01",
        createdAt: "2025-02-01T18:00:00.123999Z",
      },
    ]);
    expect(
      (await analytics()).leaderboard.find((row) => row.id === placeA)?.average,
    ).toBe("6.5");
    await db
      .update(schema.visits)
      .set({ createdAt: "2026-10-01T00:00:00Z" })
      .where(eq(schema.visits.id, ids[0]));
    expect(
      (await dashboard()).recentlyReviewedPlaces.data.find(
        (row) => row.restaurant.id === placeA,
      )?.latestVisit.id,
    ).toBe(ids[4]);
  });

  it("does not collapse friends with the same display name and supports archived profile views", async () => {
    await fixture();
    await db
      .update(schema.profiles)
      .set({ name: "Hieu" })
      .where(eq(schema.profiles.id, "nick"));
    expect(
      (await analytics()).comparison.filter((row) => row.name === "Hieu"),
    ).toHaveLength(2);
    await db.insert(schema.profiles).values({
      id: "archived-friend",
      name: "Archived",
      initials: "AF",
      avatar: "rose",
    });
    const archived = await analytics("view=personal&profileId=archived-friend");
    expect(archived.comparison).toEqual([
      {
        profileId: "archived-friend",
        name: "Archived",
        average: null,
        placeCount: 0,
        visitCount: 0,
      },
    ]);
  });

  it("preserves numeric precision near a one-decimal display boundary", async () => {
    await fixture();
    const exact = "8.94999999999999999999999999999";
    await db.update(schema.visits).set({ rating: exact });
    const result = await analytics();
    expect(formatRating(result.currentAverage)).toBe("8.9");
    for (const row of result.leaderboard)
      expect(formatRating(row.average)).toBe("8.9");
  });

  it("excludes missing ratings after latest selection, without using an earlier score or zero", async () => {
    await fixture();
    // Defensive legacy/import scenario in this disposable PostgreSQL only.
    // The application migration and create API still require every rating.
    await db.execute(sql`alter table visits alter column rating drop not null`);
    await db.execute(
      sql`insert into visits(id, restaurant_id, profile_id, rating, visit_date) values (${ids[4]}::uuid, ${placeA}::uuid, 'hieu', null, '2025-02-02')`,
    );
    const result = await analytics();
    expect(result.counts.currentScoreCount).toBe(2);
    expect(result.currentAverage).toBe("7.5");
    expect(result.leaderboard.find((row) => row.id === placeA)?.average).toBe(
      "6",
    );
    expect(
      result.timeline.find((row) => row.date === "2025-02-02"),
    ).toMatchObject({ average: "9", visitCount: 2, ratedVisitCount: 1 });
  });

  it("returns null aggregates and honest zero counts for empty and no-match datasets", async () => {
    const empty = await analytics();
    expect(empty.leaderboard).toEqual([]);
    expect(empty.timeline).toEqual([]);
    expect(empty.cuisines).toEqual([]);
    expect(empty.currentAverage).toBeNull();
    expect(empty.spending.totalCents).toBeNull();
    expect(empty.spending.averageCents).toBeNull();
    expect(Object.values(empty.counts).every((value) => value === 0)).toBe(
      true,
    );
    expect(empty.comparison.every((row) => row.average === null)).toBe(true);
    await fixture();
    const future = await analytics("start=2030-01-01&end=2030-12-31");
    expect(future.currentAverage).toBeNull();
    expect(future.timeline).toEqual([]);
    expect(future.counts.savedRestaurantCount).toBe(3);
    expect(
      (await analytics("cuisine=Unknown")).counts.savedRestaurantCount,
    ).toBe(0);
    expect(
      (await analytics("cuisine=coffee")).counts.savedRestaurantCount,
    ).toBe(0);
    expect((await analytics("end=2025-01-31")).spending).toMatchObject({
      recordedVisitCount: 0,
      totalCents: null,
      averageCents: null,
    });
    expect((await dashboard("cuisine=Unknown")).recentVisits).toMatchObject({
      data: [],
      total: 0,
      hasMore: false,
    });
  });

  it("rounds spending averages to integer cents without dropping recorded zeros", async () => {
    await fixture();
    await db.update(schema.visits).set({ amountSpent: null });
    await db
      .update(schema.visits)
      .set({ amountSpent: "0.00" })
      .where(eq(schema.visits.id, ids[0]));
    await db
      .update(schema.visits)
      .set({ amountSpent: "0.01" })
      .where(eq(schema.visits.id, ids[1]));
    expect((await analytics()).spending).toMatchObject({
      totalCents: 1,
      recordedVisitCount: 2,
      averageCents: 1,
    });
  });
});

describe("reporting query validation", () => {
  it.each([
    "view=unknown",
    "view=group&profileId=hieu",
    "start=2025-02-30",
    "start=0000-01-01",
    "start=2025-02-02&end=2025-01-01",
    "restaurantId=bad",
    "cuisine=",
    "view=group&view=personal",
    "unexpected=x",
  ])("rejects invalid filters %s consistently", async (query) => {
    await error("analytics", query, 400, "INVALID_QUERY");
    await error("dashboard", query, 400, "INVALID_QUERY");
  });
  it("validates recent limits and filtered resource references", async () => {
    for (const query of ["recentLimit=0", "recentLimit=51", "recentLimit=1.5"])
      await error("dashboard", query, 400, "INVALID_QUERY");
    await error("analytics", "recentLimit=1", 400, "INVALID_QUERY");
    await error("analytics", `restaurantId=${placeA}`, 404, "NOT_FOUND");
    await error(
      "dashboard",
      "view=personal&profileId=unknown",
      404,
      "NOT_FOUND",
    );
  });
  it("validates selected profiles before SQL", async () => {
    for (const invalid of [undefined, "unknown"]) {
      selected = invalid;
      await error("analytics", "", 401, "PROFILE_REQUIRED");
      await error("dashboard", "", 401, "PROFILE_REQUIRED");
    }
  });
});
