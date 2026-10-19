import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type {
  RestaurantCreate,
  RestaurantListQuery,
  VisitCreate,
  VisitListQuery,
  VisitUpdate,
} from "@/contracts/journal";
import * as schema from "@/db/schema";
import { normalizePlace } from "@/lib/validation";
import { ApiError } from "./api-errors";
import { centsToDollars } from "./journal-serialization";

const { restaurants, visits, profiles } = schema;
const visitOrder = [
  desc(visits.visitDate),
  desc(visits.createdAt),
  desc(visits.id),
];

// Generic over the PostgreSQL driver: identical queries run on Neon in the app
// and on PGlite PostgreSQL in integration tests. No in-memory runtime fallback.
export function createJournalRepository<Q extends PgQueryResultHKT>(
  db: PgDatabase<Q, typeof schema>,
) {
  async function restaurant(id: string) {
    return (
      await db.select().from(restaurants).where(eq(restaurants.id, id))
    )[0];
  }

  async function visit(id: string) {
    return (await db.select().from(visits).where(eq(visits.id, id)))[0];
  }

  async function history(restaurantIds: string[]) {
    return restaurantIds.length
      ? db
          .select()
          .from(visits)
          .where(inArray(visits.restaurantId, restaurantIds))
          .orderBy(...visitOrder)
      : [];
  }

  async function listRestaurants(query: RestaurantListQuery) {
    // Escape LIKE wildcards so '%' and '_' in the user's search are literal.
    const pattern = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
    const where = and(
      query.kind ? eq(restaurants.kind, query.kind) : undefined,
      query.cuisine
        ? sql`${query.cuisine} = any(${restaurants.cuisines})`
        : undefined,
      query.q
        ? or(
            ilike(restaurants.name, pattern),
            ilike(restaurants.address, pattern),
            ilike(restaurants.kind, pattern),
            sql`array_to_string(${restaurants.cuisines}, ', ') ilike ${pattern}`,
          )
        : undefined,
    );
    const [rows, totals] = await Promise.all([
      db
        .select()
        .from(restaurants)
        .where(where)
        .orderBy(asc(restaurants.normalizedName), asc(restaurants.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      db.select({ total: count() }).from(restaurants).where(where),
    ]);
    return {
      rows,
      total: totals[0].total,
      history: await history(rows.map((row) => row.id)),
    };
  }

  async function createRestaurant(input: RestaurantCreate) {
    if (input.provider !== null && input.providerPlaceId !== null) {
      const existing = await db
        .select()
        .from(restaurants)
        .where(
          and(
            eq(restaurants.provider, input.provider),
            eq(restaurants.providerPlaceId, input.providerPlaceId),
          ),
        );
      if (existing.length)
        throw new ApiError(
          409,
          "PROVIDER_ID_CONFLICT",
          "This provider place is already saved.",
          {},
          {
            duplicates: existing.map(({ id, name, address }) => ({
              id,
              name,
              address,
            })),
          },
        );
    }
    const normalizedName = normalizePlace(input.name);
    const normalizedAddress = normalizePlace(input.address);
    const duplicates = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        address: restaurants.address,
      })
      .from(restaurants)
      .where(
        and(
          eq(restaurants.normalizedName, normalizedName),
          eq(restaurants.normalizedAddress, normalizedAddress),
        ),
      )
      .orderBy(asc(restaurants.id))
      .limit(20);
    if (duplicates.length && !input.confirmDuplicate)
      throw new ApiError(
        409,
        "POSSIBLE_DUPLICATE",
        "A place with this normalized name and address is already saved. Open it or confirm this is a different place.",
        {},
        { duplicates },
      );
    const {
      name,
      address,
      kind,
      cuisines,
      priceTier,
      provider,
      providerPlaceId,
    } = input;
    const values = {
      name,
      address,
      kind,
      cuisines,
      priceTier,
      provider,
      providerPlaceId,
    };
    // The unique index resolves provider-ID races atomically. Manual duplicate
    // checks are advisory because an explicit confirmation permits duplicates.
    const [created] = await db
      .insert(restaurants)
      .values({ ...values, normalizedName, normalizedAddress })
      .onConflictDoNothing({
        target: [restaurants.provider, restaurants.providerPlaceId],
      })
      .returning();
    if (!created)
      throw new ApiError(
        409,
        "PROVIDER_ID_CONFLICT",
        "This provider place was saved by another request. Search the saved places.",
      );
    return created;
  }

  async function listVisits(query: VisitListQuery) {
    const where = and(
      query.restaurantId
        ? eq(visits.restaurantId, query.restaurantId)
        : undefined,
      query.profileId ? eq(visits.profileId, query.profileId) : undefined,
      query.start ? gte(visits.visitDate, query.start) : undefined,
      query.end ? lte(visits.visitDate, query.end) : undefined,
    );
    const [rows, totals] = await Promise.all([
      db
        .select()
        .from(visits)
        .where(where)
        .orderBy(...visitOrder)
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      db.select({ total: count() }).from(visits).where(where),
    ]);
    return { rows, total: totals[0].total };
  }

  async function createVisit(input: VisitCreate, profileId: string) {
    const [profile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, profileId));
    if (!profile)
      throw new ApiError(
        409,
        "PROFILE_UNAVAILABLE",
        "The selected profile has not been seeded in the journal database.",
      );
    if (!(await restaurant(input.restaurantId)))
      throw new ApiError(
        404,
        "NOT_FOUND",
        "The saved restaurant could not be found.",
        { restaurantId: ["Choose an existing saved restaurant."] },
      );
    const { amountSpentCents, rating, ...rest } = input;
    const [created] = await db
      .insert(visits)
      .values({
        ...rest,
        profileId,
        rating: String(rating),
        amountSpent: centsToDollars(amountSpentCents),
      })
      .returning();
    return created;
  }

  async function ownedVisit(id: string, profileId: string) {
    const existing = await visit(id);
    if (!existing)
      throw new ApiError(404, "NOT_FOUND", "The visit could not be found.");
    // Shared profile selection is a convenience, not identity verification.
    if (existing.profileId !== profileId)
      throw new ApiError(
        403,
        "PROFILE_MISMATCH",
        "Select the visit's profile before changing it.",
      );
    return existing;
  }

  async function updateVisit(
    id: string,
    input: VisitUpdate,
    profileId: string,
  ) {
    await ownedVisit(id, profileId);
    const { amountSpentCents, rating, ...rest } = input;
    const [updated] = await db
      .update(visits)
      .set({
        ...rest,
        ...(rating === undefined ? {} : { rating: String(rating) }),
        ...(amountSpentCents === undefined
          ? {}
          : { amountSpent: centsToDollars(amountSpentCents) }),
        updatedAt: sql`clock_timestamp()`,
      })
      .where(and(eq(visits.id, id), eq(visits.profileId, profileId)))
      .returning();
    if (!updated)
      throw new ApiError(404, "NOT_FOUND", "The visit is no longer available.");
    return updated;
  }

  async function deleteVisit(id: string, profileId: string) {
    await ownedVisit(id, profileId);
    const [deleted] = await db
      .delete(visits)
      .where(and(eq(visits.id, id), eq(visits.profileId, profileId)))
      .returning();
    if (!deleted)
      throw new ApiError(404, "NOT_FOUND", "The visit is no longer available.");
    return deleted;
  }

  return {
    restaurant,
    visit,
    history,
    listRestaurants,
    createRestaurant,
    listVisits,
    createVisit,
    updateVisit,
    deleteVisit,
  };
}

export type JournalRepository = ReturnType<typeof createJournalRepository>;
