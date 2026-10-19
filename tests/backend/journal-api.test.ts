import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
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
import type { z } from "zod";
import {
  apiErrorSchema,
  externalSearchResponseSchema,
  MAX_SPENDING_CENTS,
  restaurantListResponseSchema,
  restaurantResponseSchema,
  visitDeleteResponseSchema,
  visitListResponseSchema,
  visitResponseSchema,
} from "../../src/contracts/journal";
import * as schema from "../../src/db/schema";
import { seedProfiles } from "../../src/db/seed-profiles";
import { createJournalApi } from "../../src/server/journal-api";
import { createJournalRepository } from "../../src/server/journal-repository";
import type { PlaceProviderAdapter } from "../../src/server/place-provider";

const client = new PGlite();
const db = drizzle(client, { schema });
const repository = createJournalRepository(db);
let selected: string | undefined = "hieu";
let provider: PlaceProviderAdapter | null = null;
const onMutation = vi.fn();
const reportError = vi.fn();
const api = createJournalApi({
  repository: () => repository,
  selectedProfile: async () => selected,
  today: () => "2026-10-18",
  provider: () => provider,
  onMutation,
  reportError,
});

const place = {
  name: "Café Moon",
  address: "123 Main St., Seattle",
  kind: "cafe",
  cuisines: ["Coffee", "Brunch"],
};
const request = (
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

async function read<T>(
  contract: z.ZodType<T>,
  response: Response,
  status = 200,
): Promise<T> {
  const body: unknown = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  return contract.parse(body);
}

async function failure(response: Response, status: number, code: string) {
  const result = await read(apiErrorSchema, response, status);
  expect(result.error.code).toBe(code);
  return result.error;
}

async function addPlace(overrides: Record<string, unknown> = {}) {
  return (
    await read(
      restaurantResponseSchema,
      await api.createRestaurant(
        request("/api/restaurants", "POST", { ...place, ...overrides }),
      ),
      201,
    )
  ).data;
}

async function addVisit(
  restaurantId: string,
  overrides: Record<string, unknown> = {},
) {
  return (
    await read(
      visitResponseSchema,
      await api.createVisit(
        request("/api/visits", "POST", {
          restaurantId,
          rating: 8.5,
          visitDate: "2026-10-17",
          ...overrides,
        }),
      ),
      201,
    )
  ).data;
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});
afterAll(async () => {
  await client.close();
});
beforeEach(async () => {
  await db.delete(schema.visits);
  await db.delete(schema.restaurants);
  await seedProfiles(db);
  selected = "hieu";
  provider = null;
  onMutation.mockReset();
  reportError.mockReset();
});

describe("restaurant API against the committed PostgreSQL migrations", () => {
  it("creates a manual place with honest empty scores, retrieves it, and hides normalization columns", async () => {
    const created = await addPlace();
    expect(created).toMatchObject({
      name: place.name,
      kind: "cafe",
      provider: null,
      providerPlaceId: null,
      currentRating: {
        average: null,
        agreement: null,
        reviewerCount: 0,
        visitCount: 0,
        scores: [],
      },
    });
    const response = await api.getRestaurant(
      request(`/api/restaurants/${created.id}`),
      created.id,
    );
    const raw = await response.clone().json();
    expect(raw.data).not.toHaveProperty("normalizedName");
    expect(raw.data).not.toHaveProperty("normalizedAddress");
    expect((await read(restaurantResponseSchema, response)).data).toEqual(
      created,
    );
    expect(onMutation).toHaveBeenCalledTimes(1);
  });

  it("warns for accent/punctuation/case/whitespace normalized duplicates and requires explicit confirmation", async () => {
    const saved = await addPlace();
    const duplicate = {
      ...place,
      name: "  CAFE   MOON!  ",
      address: "123 MAIN ST Seattle",
    };
    const error = await failure(
      await api.createRestaurant(
        request("/api/restaurants", "POST", duplicate),
      ),
      409,
      "POSSIBLE_DUPLICATE",
    );
    expect(error.details?.duplicates).toEqual([
      { id: saved.id, name: place.name, address: place.address },
    ]);
    expect(await db.select().from(schema.restaurants)).toHaveLength(1);
    const confirmed = await addPlace({ ...duplicate, confirmDuplicate: true });
    expect(confirmed.id).not.toBe(saved.id);
    expect(await db.select().from(schema.restaurants)).toHaveLength(2);
  });

  it("does not mark a branch at a different address or a different name as the same manual place", async () => {
    await addPlace();
    await addPlace({ address: "Another street" });
    await addPlace({ name: "Another café" });
    expect(await db.select().from(schema.restaurants)).toHaveLength(3);
  });

  it("enforces provider identity even if duplicate confirmation is supplied", async () => {
    const saved = await addPlace({
      provider: " Example ",
      providerPlaceId: "ABC",
    });
    const error = await failure(
      await api.createRestaurant(
        request("/api/restaurants", "POST", {
          ...place,
          name: "Renamed place",
          address: "Moved address",
          provider: "EXAMPLE",
          providerPlaceId: "ABC",
          confirmDuplicate: true,
        }),
      ),
      409,
      "PROVIDER_ID_CONFLICT",
    );
    expect(error.details?.duplicates?.[0].id).toBe(saved.id);
    await addPlace({
      provider: "example",
      providerPlaceId: "abc",
      address: "other address",
    });
    expect(await db.select().from(schema.restaurants)).toHaveLength(2);
  });

  it("lets the unique index resolve racing provider submissions without exposing database errors", async () => {
    const body = {
      ...place,
      provider: "example",
      providerPlaceId: "race",
      confirmDuplicate: true,
    };
    const responses = await Promise.all([
      api.createRestaurant(request("/api/restaurants", "POST", body)),
      api.createRestaurant(request("/api/restaurants", "POST", body)),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    await failure(
      responses.find((response) => response.status === 409)!,
      409,
      "PROVIDER_ID_CONFLICT",
    );
    expect(await db.select().from(schema.restaurants)).toHaveLength(1);
  });

  it.each([
    { provider: "example" },
    { providerPlaceId: "id" },
    { name: "!!!" },
    { address: "---" },
    { name: "x".repeat(161) },
    { address: "x".repeat(301) },
    { cuisines: Array(9).fill("Coffee") },
    { cuisines: ["x".repeat(61)] },
    { kind: "bar" },
    { priceTier: 5 },
    { confirmDuplicate: "true" },
  ])("validates manual entry fields: %j", async (invalid) => {
    await failure(
      await api.createRestaurant(
        request("/api/restaurants", "POST", { ...place, ...invalid }),
      ),
      422,
      "VALIDATION_ERROR",
    );
  });

  it("searches saved names, addresses, categories and type with stable pagination", async () => {
    const first = await addPlace({
      name: "Alpha Coffee",
      cuisines: ["Ethiopian"],
    });
    await addPlace({
      name: "Beta Bakery",
      address: "42 Harbor",
      cuisines: ["Pastries"],
      kind: "restaurant",
    });
    for (const term of ["alpha", "MAIN ST", "ethiopian", "cafe"]) {
      const result = await read(
        restaurantListResponseSchema,
        await api.listRestaurants(
          request(`/api/restaurants?q=${encodeURIComponent(term)}`),
        ),
      );
      expect(result.data.map((row) => row.id)).toEqual([first.id]);
    }
    const page1 = await read(
      restaurantListResponseSchema,
      await api.listRestaurants(request("/api/restaurants?pageSize=1")),
    );
    const page2 = await read(
      restaurantListResponseSchema,
      await api.listRestaurants(request("/api/restaurants?pageSize=1&page=2")),
    );
    expect(page1.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      hasNextPage: true,
    });
    expect(page1.data[0].name).toBe("Alpha Coffee");
    expect(page2.data[0].name).toBe("Beta Bakery");
    expect(page2.pagination.hasNextPage).toBe(false);
    expect(
      (
        await read(
          restaurantListResponseSchema,
          await api.listRestaurants(
            request("/api/restaurants?page=3&pageSize=1"),
          ),
        )
      ).data,
    ).toEqual([]);
    expect(
      (
        await read(
          restaurantListResponseSchema,
          await api.listRestaurants(
            request("/api/restaurants?kind=restaurant"),
          ),
        )
      ).data,
    ).toHaveLength(1);
    const cuisine = await read(
      restaurantListResponseSchema,
      await api.listRestaurants(
        request("/api/restaurants?cuisine=Ethiopian&q=Alpha"),
      ),
    );
    expect(cuisine.data.map((row) => row.id)).toEqual([first.id]);
    expect(
      (
        await read(
          restaurantListResponseSchema,
          await api.listRestaurants(
            request("/api/restaurants?cuisine=ethiopian"),
          ),
        )
      ).data,
    ).toEqual([]);
  });

  it("treats search wildcards and SQL-looking values as literal text", async () => {
    await addPlace({ name: "100% Coffee" });
    await addPlace({ name: "Other Cafe", address: "Other street" });
    const literal = await read(
      restaurantListResponseSchema,
      await api.listRestaurants(request("/api/restaurants?q=%25")),
    );
    expect(literal.data.map((row) => row.name)).toEqual(["100% Coffee"]);
    expect(
      (
        await read(
          restaurantListResponseSchema,
          await api.listRestaurants(
            request(`/api/restaurants?q=${encodeURIComponent("' OR 1=1 --")}`),
          ),
        )
      ).data,
    ).toEqual([]);
  });

  it("returns explicit empty and missing-resource states", async () => {
    expect(
      (
        await read(
          restaurantListResponseSchema,
          await api.listRestaurants(request("/api/restaurants")),
        )
      ).pagination.total,
    ).toBe(0);
    await failure(
      await api.getRestaurant(
        request("/api/restaurants/missing"),
        "10000000-0000-4000-8000-000000000001",
      ),
      404,
      "NOT_FOUND",
    );
    await failure(
      await api.getRestaurant(request("/api/restaurants/no"), "no"),
      400,
      "INVALID_ID",
    );
  });
});

describe("visit API and centralized current ratings", () => {
  it("creates repeat visits, gives each friend one vote, and restores previous scores after deletion", async () => {
    const restaurant = await addPlace();
    const earlier = await addVisit(restaurant.id, {
      rating: 6,
      visitDate: "2026-10-01",
      amountSpentCents: 10,
    });
    const latest = await addVisit(restaurant.id, {
      rating: 10,
      visitDate: "2026-10-17",
    });
    selected = "nick";
    await addVisit(restaurant.id, { rating: 8 });
    let detail = (
      await read(
        restaurantResponseSchema,
        await api.getRestaurant(request("/api/restaurants/x"), restaurant.id),
      )
    ).data;
    expect(detail.currentRating).toMatchObject({
      average: "9",
      reviewerCount: 2,
      visitCount: 3,
    });
    expect(
      detail.currentRating.scores.find((score) => score.profileId === "hieu")
        ?.visitId,
    ).toBe(latest.id);
    selected = "hieu";
    const deleted = await read(
      visitDeleteResponseSchema,
      await api.deleteVisit(
        request(`/api/visits/${latest.id}`, "DELETE"),
        latest.id,
      ),
    );
    expect(deleted.data).toEqual({
      id: latest.id,
      restaurantId: restaurant.id,
      deleted: true,
    });
    detail = (
      await read(
        restaurantResponseSchema,
        await api.getRestaurant(request("/api/restaurants/x"), restaurant.id),
      )
    ).data;
    expect(detail.currentRating).toMatchObject({
      average: "7",
      reviewerCount: 2,
      visitCount: 2,
    });
    expect(
      detail.currentRating.scores.find((score) => score.profileId === "hieu")
        ?.visitId,
    ).toBe(earlier.id);
    expect(
      (
        await read(
          visitResponseSchema,
          await api.getVisit(request("/api/visits/x"), earlier.id),
        )
      ).data.amountSpentCents,
    ).toBe(10);
    await failure(
      await api.deleteVisit(request("/api/visits/x", "DELETE"), latest.id),
      404,
      "NOT_FOUND",
    );
  });

  it("uses visit date, PostgreSQL microsecond creation time and finally stable ID in both summaries and history", async () => {
    const restaurant = await addPlace();
    const ids = [
      "20000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000002",
      "20000000-0000-4000-8000-000000000003",
      "20000000-0000-4000-8000-000000000004",
    ];
    await db.insert(schema.visits).values([
      {
        id: ids[3],
        restaurantId: restaurant.id,
        profileId: "hieu",
        rating: "2",
        visitDate: "2026-01-01",
        createdAt: "2026-10-18T00:00:00Z",
      },
      {
        id: ids[2],
        restaurantId: restaurant.id,
        profileId: "hieu",
        rating: "3",
        visitDate: "2026-10-17",
        createdAt: "2026-10-17T18:00:00.123111Z",
      },
      {
        id: ids[0],
        restaurantId: restaurant.id,
        profileId: "hieu",
        rating: "7",
        visitDate: "2026-10-17",
        createdAt: "2026-10-17T18:00:00.123999Z",
      },
      {
        id: ids[1],
        restaurantId: restaurant.id,
        profileId: "hieu",
        rating: "9",
        visitDate: "2026-10-17",
        createdAt: "2026-10-17T18:00:00.123999Z",
      },
    ]);
    const summary = (
      await read(
        restaurantResponseSchema,
        await api.getRestaurant(request("/api/restaurants/x"), restaurant.id),
      )
    ).data.currentRating;
    expect(summary).toMatchObject({
      average: "9",
      reviewerCount: 1,
      visitCount: 4,
    });
    expect(summary.scores[0].visitId).toBe(ids[1]);
    const history = await read(
      visitListResponseSchema,
      await api.listVisits(
        request(`/api/visits?restaurantId=${restaurant.id}`),
      ),
    );
    expect(history.data.map((row) => row.id)).toEqual([
      ids[1],
      ids[0],
      ids[2],
      ids[3],
    ]);
    expect(history.data[0].createdAt).toContain(".123999");
  });

  it("corrects dates and ratings without replacing creation time or clearing omitted optional fields", async () => {
    const restaurant = await addPlace();
    const earlier = await addVisit(restaurant.id, {
      rating: 6,
      visitDate: "2026-01-01",
    });
    const latest = await addVisit(restaurant.id, {
      rating: 10,
      reviewText: "Keep review",
      orderDescription: "Keep order",
      amountSpentCents: 1999,
    });
    const corrected = (
      await read(
        visitResponseSchema,
        await api.updateVisit(
          request("/api/visits/x", "PATCH", { rating: 8.04 }),
          latest.id,
        ),
      )
    ).data;
    expect(corrected).toMatchObject({
      rating: 8.04,
      reviewText: "Keep review",
      orderDescription: "Keep order",
      amountSpentCents: 1999,
      createdAt: latest.createdAt,
    });
    await read(
      visitResponseSchema,
      await api.updateVisit(
        request("/api/visits/x", "PATCH", { visitDate: "2025-01-01" }),
        latest.id,
      ),
    );
    const summary = (
      await read(
        restaurantResponseSchema,
        await api.getRestaurant(request("/api/restaurants/x"), restaurant.id),
      )
    ).data.currentRating;
    expect(summary.average).toBe("6");
    expect(summary.scores[0].visitId).toBe(earlier.id);
    const cleared = (
      await read(
        visitResponseSchema,
        await api.updateVisit(
          request("/api/visits/x", "PATCH", {
            reviewText: null,
            orderDescription: "   ",
            amountSpentCents: null,
          }),
          latest.id,
        ),
      )
    ).data;
    expect(cleared).toMatchObject({
      reviewText: null,
      orderDescription: null,
      amountSpentCents: null,
    });
  });

  it("distinguishes missing spending from a recorded zero and preserves integer cents exactly", async () => {
    const restaurant = await addPlace();
    for (const cents of [null, 0, 10, 1999, MAX_SPENDING_CENTS]) {
      const saved = await addVisit(restaurant.id, { amountSpentCents: cents });
      expect(saved.amountSpentCents).toBe(cents);
      const [row] = await db
        .select()
        .from(schema.visits)
        .where(eq(schema.visits.id, saved.id));
      if (cents === 10) expect(row.amountSpent).toBe("0.10");
      expect(
        (
          await read(
            visitResponseSchema,
            await api.getVisit(request("/api/visits/x"), saved.id),
          )
        ).data.amountSpentCents,
      ).toBe(cents);
    }
  });

  it.each([1, 1.001, 8.04, 8.999999, 10])(
    "accepts any in-range decimal rating %s",
    async (rating) => {
      expect((await addVisit((await addPlace()).id, { rating })).rating).toBe(
        rating,
      );
    },
  );

  it.each([
    { rating: 0.9 },
    { rating: 10.01 },
    { rating: "8.5" },
    { rating: null },
    { visitDate: "2026-10-19" },
    { visitDate: "2025-02-29" },
    { visitDate: "2026-02-30" },
    { visitDate: "2026-1-01" },
    { visitDate: "0000-01-01" },
    { reviewText: "x".repeat(2001) },
    { orderDescription: "x".repeat(301) },
    { amountSpentCents: -1 },
    { amountSpentCents: 1.5 },
    { amountSpentCents: "1999" },
    { amountSpentCents: MAX_SPENDING_CENTS + 1 },
    { amountSpent: "19.99" },
    { profileId: "nick" },
    { currency: "EUR" },
  ])("rejects invalid visit fields %j", async (invalid) => {
    const restaurant = await addPlace();
    const error = await failure(
      await api.createVisit(
        request("/api/visits", "POST", {
          restaurantId: restaurant.id,
          rating: 8,
          visitDate: "2026-10-17",
          ...invalid,
        }),
      ),
      422,
      "VALIDATION_ERROR",
    );
    expect(Object.keys(error.fieldErrors).length).toBeGreaterThan(0);
    expect(await db.select().from(schema.visits)).toHaveLength(0);
  });

  it("accepts leap days and exact text limits, but requires a restaurant, rating and date", async () => {
    const restaurant = await addPlace();
    await addVisit(restaurant.id, {
      visitDate: "2024-02-29",
      reviewText: "x".repeat(2000),
      orderDescription: "x".repeat(300),
    });
    await failure(
      await api.createVisit(request("/api/visits", "POST", {})),
      422,
      "VALIDATION_ERROR",
    );
    await failure(
      await api.createVisit(
        request("/api/visits", "POST", {
          restaurantId: "10000000-0000-4000-8000-000000000099",
          rating: 8,
          visitDate: "2026-10-17",
        }),
      ),
      404,
      "NOT_FOUND",
    );
  });

  it("rejects empty patches and immutable fields", async () => {
    const saved = await addVisit((await addPlace()).id);
    for (const patch of [
      {},
      { restaurantId: saved.restaurantId },
      { profileId: "nick" },
      { createdAt: "2026-01-01T00:00:00Z" },
      { rating: 11 },
    ]) {
      await failure(
        await api.updateVisit(
          request("/api/visits/x", "PATCH", patch),
          saved.id,
        ),
        422,
        "VALIDATION_ERROR",
      );
    }
  });

  it("allows shared reads but restricts edits/deletes to the selected profile", async () => {
    const saved = await addVisit((await addPlace()).id);
    selected = "nick";
    await read(
      visitResponseSchema,
      await api.getVisit(request("/api/visits/x"), saved.id),
    );
    await failure(
      await api.updateVisit(
        request("/api/visits/x", "PATCH", { rating: 3 }),
        saved.id,
      ),
      403,
      "PROFILE_MISMATCH",
    );
    await failure(
      await api.deleteVisit(request("/api/visits/x", "DELETE"), saved.id),
      403,
      "PROFILE_MISMATCH",
    );
    expect((await repository.visit(saved.id))?.rating).toBe("8.5");
  });

  it("validates profile selection and requires the selected profile to be seeded on create", async () => {
    const restaurant = await addPlace();
    for (const invalid of [undefined, "stranger", ""]) {
      selected = invalid;
      await failure(
        await api.listRestaurants(request("/api/restaurants")),
        401,
        "PROFILE_REQUIRED",
      );
      await failure(
        await api.createVisit(
          request("/api/visits", "POST", {
            restaurantId: restaurant.id,
            rating: 8,
            visitDate: "2026-10-17",
          }),
        ),
        401,
        "PROFILE_REQUIRED",
      );
    }
    selected = "nick";
    await db.delete(schema.profiles).where(eq(schema.profiles.id, "nick"));
    await failure(
      await api.createVisit(
        request("/api/visits", "POST", {
          restaurantId: restaurant.id,
          rating: 8,
          visitDate: "2026-10-17",
        }),
      ),
      409,
      "PROFILE_UNAVAILABLE",
    );
  });

  it("paginates filtered history while summaries still include all current scores", async () => {
    const restaurant = await addPlace();
    const other = await addPlace({
      name: "Other restaurant",
      address: "Other street",
    });
    await addVisit(restaurant.id, { visitDate: "2026-10-01" });
    await addVisit(restaurant.id, { visitDate: "2026-10-17" });
    selected = "nick";
    await addVisit(restaurant.id, { visitDate: "2026-10-17", rating: 9 });
    await addVisit(other.id);
    const result = await read(
      visitListResponseSchema,
      await api.listVisits(
        request(
          `/api/visits?restaurantId=${restaurant.id}&profileId=hieu&start=2026-10-17&end=2026-10-17&pageSize=1`,
        ),
      ),
    );
    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      profileId: "hieu",
      visitDate: "2026-10-17",
    });
    const list = await read(
      restaurantListResponseSchema,
      await api.listRestaurants(request("/api/restaurants?pageSize=1")),
    );
    expect(
      list.data.find((row) => row.id === restaurant.id)?.currentRating,
    ).toMatchObject({ reviewerCount: 2, visitCount: 3, average: "8.75" });
  });

  it("returns no average after the last visit is deleted", async () => {
    const restaurant = await addPlace();
    const saved = await addVisit(restaurant.id);
    await read(
      visitDeleteResponseSchema,
      await api.deleteVisit(request("/api/visits/x", "DELETE"), saved.id),
    );
    const detail = await read(
      restaurantResponseSchema,
      await api.getRestaurant(request("/api/restaurants/x"), restaurant.id),
    );
    expect(detail.data.currentRating).toEqual({
      average: null,
      agreement: null,
      reviewerCount: 0,
      visitCount: 0,
      scores: [],
    });
  });

  it("keeps retained history readable for profiles removed from selectable configuration", async () => {
    const restaurant = await addPlace();
    await db.insert(schema.profiles).values({
      id: "archived-friend",
      name: "Archived friend",
      initials: "AF",
      avatar: "rose",
    });
    const [retained] = await db
      .insert(schema.visits)
      .values({
        restaurantId: restaurant.id,
        profileId: "archived-friend",
        rating: "7",
        visitDate: "2026-10-17",
      })
      .returning();
    const response = await read(
      visitResponseSchema,
      await api.getVisit(request("/api/visits/x"), retained.id),
    );
    expect(response.data.profileId).toBe("archived-friend");
    const summary = (
      await read(
        restaurantResponseSchema,
        await api.getRestaurant(request("/api/restaurants/x"), restaurant.id),
      )
    ).data.currentRating;
    expect(summary.scores[0].profileId).toBe("archived-friend");
    expect(summary.average).toBe("7");
  });
});

describe("shared HTTP input and external search behavior", () => {
  it.each([
    "page=0",
    "pageSize=101",
    "pageSize=1.5",
    "page=NaN",
    "page=1&page=2",
    "unknown=value",
  ])("uses common query errors for %s", async (query) => {
    await failure(
      await api.listRestaurants(request(`/api/restaurants?${query}`)),
      400,
      "INVALID_QUERY",
    );
    await failure(
      await api.listVisits(request(`/api/visits?${query}`)),
      400,
      "INVALID_QUERY",
    );
  });

  it("validates date-filter order, profile filters and missing resources", async () => {
    await failure(
      await api.listVisits(
        request("/api/visits?start=2026-10-17&end=2026-10-01"),
      ),
      400,
      "INVALID_QUERY",
    );
    await failure(
      await api.listVisits(request("/api/visits?profileId=stranger")),
      400,
      "INVALID_QUERY",
    );
    await failure(
      await api.listVisits(
        request(
          "/api/visits?restaurantId=10000000-0000-4000-8000-000000000001",
        ),
      ),
      404,
      "NOT_FOUND",
    );
    await failure(
      await api.getVisit(
        request("/api/visits/x"),
        "10000000-0000-4000-8000-000000000001",
      ),
      404,
      "NOT_FOUND",
    );
  });

  it("uses common errors for malformed JSON, wrong content type, oversized bodies and cross-origin writes", async () => {
    await failure(
      await api.createRestaurant(
        new Request("http://localhost/api/restaurants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        }),
      ),
      400,
      "INVALID_JSON",
    );
    await failure(
      await api.createRestaurant(
        new Request("http://localhost/api/restaurants", {
          method: "POST",
          body: "name=Moon",
        }),
      ),
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    );
    await failure(
      await api.createRestaurant(
        request("/api/restaurants", "POST", {
          ...place,
          name: "x".repeat(17000),
        }),
      ),
      413,
      "PAYLOAD_TOO_LARGE",
    );
    await failure(
      await api.createRestaurant(
        request("/api/restaurants", "POST", place, {
          Origin: "https://another.example",
        }),
      ),
      403,
      "FORBIDDEN_ORIGIN",
    );
    await failure(
      await api.createRestaurant(
        request("/api/restaurants", "POST", place, {
          "Sec-Fetch-Site": "cross-site",
        }),
      ),
      403,
      "FORBIDDEN_ORIGIN",
    );
  });

  it("returns an honest unconfigured state without external requests or database writes", async () => {
    const result = await read(
      externalSearchResponseSchema,
      await api.externalSearch(request("/api/places/search?q=coffee")),
    );
    expect(result).toMatchObject({
      status: "unconfigured",
      provider: null,
      data: [],
      pagination: { total: 0 },
    });
    expect(await db.select().from(schema.restaurants)).toHaveLength(0);
    await failure(
      await api.externalSearch(request("/api/places/search?q=")),
      400,
      "INVALID_QUERY",
    );
  });

  it("passes paging, attribution and cancellation to a configured adapter without persisting search results", async () => {
    const search = vi.fn().mockResolvedValue({
      data: [
        {
          provider: "test",
          providerPlaceId: "ext1",
          name: "External cafe",
          address: "External address",
          categories: ["Coffee"],
          attribution: {
            text: "Test provider",
            url: "https://provider.example/place/ext1",
          },
        },
      ],
      total: 3,
    });
    provider = { name: "test", search, getDetails: vi.fn() };
    const result = await read(
      externalSearchResponseSchema,
      await api.externalSearch(
        request("/api/places/search?q=coffee&page=2&pageSize=1"),
      ),
    );
    expect(result).toMatchObject({
      status: "configured",
      provider: "test",
      pagination: { page: 2, pageSize: 1, total: 3, hasNextPage: true },
    });
    expect(search).toHaveBeenCalledWith(
      "coffee",
      expect.objectContaining({
        page: 2,
        pageSize: 1,
        signal: expect.any(AbortSignal),
      }),
    );
    expect(await db.select().from(schema.restaurants)).toHaveLength(0);
  });

  it("returns provider failures as errors instead of empty or fabricated success", async () => {
    provider = {
      name: "test",
      search: vi.fn().mockRejectedValue(new Error("private upstream details")),
      getDetails: vi.fn(),
    };
    await failure(
      await api.externalSearch(request("/api/places/search?q=coffee")),
      502,
      "PROVIDER_UNAVAILABLE",
    );
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it("still acknowledges committed writes if cache invalidation fails", async () => {
    onMutation.mockRejectedValueOnce(new Error("cache unavailable"));
    await addPlace();
    expect(await db.select().from(schema.restaurants)).toHaveLength(1);
    expect(reportError).toHaveBeenCalledTimes(1);
  });
});
