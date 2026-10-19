import { PGlite } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { friendProfiles } from "../src/config/profiles";
import * as schema from "../src/db/schema";
import { seedProfiles } from "../src/db/seed-profiles";
import { currentRatings, restaurantSummary } from "../src/lib/ratings";
import { journalFixture, placeA, visit } from "./fixtures";

const client = new PGlite();
const db = drizzle(client, { schema });
const place = journalFixture().restaurants[0];

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
  await db.insert(schema.restaurants).values(place);
});

describe("committed SQL migration and profile seed (PGlite PostgreSQL)", () => {
  it("can re-run the migrator and profile seed without duplicating or deleting data", async () => {
    await db.insert(schema.visits).values(visit());
    await seedProfiles(db);
    await seedProfiles(db);
    await migrate(db, { migrationsFolder: "./drizzle" });
    expect(await db.select().from(schema.profiles)).toHaveLength(
      friendProfiles.length,
    );
    expect(await db.select().from(schema.restaurants)).toHaveLength(1);
    expect(await db.select().from(schema.visits)).toHaveLength(1);
    expect(
      (await db.select().from(schema.profiles)).map((row) => row.name).sort(),
    ).toEqual(friendProfiles.map((row) => row.name).sort());
  });
  it("preserves decimal monetary values and optional nulls through a database round trip", async () => {
    await db.insert(schema.visits).values([
      visit({
        id: "20000000-0000-4000-8000-000000000001",
        amountSpent: "0.10",
      }),
      visit({
        id: "20000000-0000-4000-8000-000000000002",
        amountSpent: null,
      }),
    ]);
    const rows = await db
      .select()
      .from(schema.visits)
      .orderBy(schema.visits.id);
    expect(rows[0].amountSpent).toBe("0.10");
    expect(rows[1].amountSpent).toBeNull();
  });
  it("recalculates the current score after real deletion and after editing the visit date", async () => {
    const earlier = visit({
      id: "20000000-0000-4000-8000-000000000001",
      rating: "6",
    });
    const newer = visit({
      id: "20000000-0000-4000-8000-000000000002",
      rating: "10",
      visitDate: "2025-02-01",
    });
    const nick = visit({
      id: "20000000-0000-4000-8000-000000000003",
      profileId: "nick",
      rating: "8",
    });
    await db.insert(schema.visits).values([earlier, newer, nick]);
    expect(
      restaurantSummary(
        await db.select().from(schema.visits),
        placeA,
      ).average?.toString(),
    ).toBe("9");
    await db
      .update(schema.visits)
      .set({ visitDate: "2024-12-01" })
      .where(eq(schema.visits.id, newer.id));
    expect(
      restaurantSummary(
        await db.select().from(schema.visits),
        placeA,
      ).average?.toString(),
    ).toBe("7");
    await db
      .update(schema.visits)
      .set({ visitDate: "2025-02-01" })
      .where(eq(schema.visits.id, newer.id));
    await db
      .delete(schema.visits)
      .where(
        and(
          eq(schema.visits.id, newer.id),
          eq(schema.visits.profileId, "hieu"),
        ),
      );
    expect(
      restaurantSummary(
        await db.select().from(schema.visits),
        placeA,
      ).average?.toString(),
    ).toBe("7");
    await db.delete(schema.visits).where(eq(schema.visits.profileId, "hieu"));
    expect(currentRatings(await db.select().from(schema.visits))).toHaveLength(
      1,
    );
  });
  it.each(["0.9", "10.01", "NaN"])(
    "rejects invalid rating %s at the database boundary",
    async (rating) => {
      await expect(
        db.insert(schema.visits).values(visit({ rating })),
      ).rejects.toThrow();
    },
  );
  it("rejects missing ratings, invalid references, negative spending, and future dates", async () => {
    await expect(
      db.insert(schema.visits).values({ ...visit(), rating: sql`null` }),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.visits).values(visit({ profileId: "not-a-profile" })),
    ).rejects.toThrow();
    await expect(
      db
        .insert(schema.visits)
        .values(
          visit({ restaurantId: "99999999-0000-4000-8000-000000000001" }),
        ),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.visits).values(visit({ amountSpent: "-0.01" })),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.visits).values(visit({ amountSpent: "NaN" })),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.visits).values(visit({ visitDate: "2999-01-01" })),
    ).rejects.toThrow();
  });
  it("enforces text limits and USD-only release-one spending", async () => {
    await expect(
      db.insert(schema.visits).values(visit({ reviewText: "x".repeat(2001) })),
    ).rejects.toThrow();
    await expect(
      db
        .insert(schema.visits)
        .values(visit({ orderDescription: "x".repeat(301) })),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.visits).values(visit({ currency: "EUR" })),
    ).rejects.toThrow();
  });
  it("enforces unique provider identity and complete provider identifiers", async () => {
    await db
      .update(schema.restaurants)
      .set({ provider: "test-provider", providerPlaceId: "123" })
      .where(eq(schema.restaurants.id, placeA));
    await expect(
      db.insert(schema.restaurants).values({
        ...place,
        id: "10000000-0000-4000-8000-000000000003",
        provider: "test-provider",
        providerPlaceId: "123",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.restaurants).values({
        ...place,
        id: "10000000-0000-4000-8000-000000000003",
        provider: "test-provider",
        providerPlaceId: null,
      }),
    ).rejects.toThrow();
  });
  it("restricts orphaning visits and creates the history/duplicate lookup indexes", async () => {
    await db.insert(schema.visits).values(visit());
    await expect(
      db.delete(schema.profiles).where(eq(schema.profiles.id, "hieu")),
    ).rejects.toThrow();
    await expect(
      db.delete(schema.restaurants).where(eq(schema.restaurants.id, placeA)),
    ).rejects.toThrow();
    const indexes = await client.query<{ indexname: string }>(
      "select indexname from pg_indexes where schemaname = 'public'",
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        "visit_current_rating_lookup",
        "visit_profile_history",
        "restaurant_manual_duplicate_lookup",
        "restaurant_provider_identity",
      ]),
    );
  });
});
