import "server-only";
import { cache } from "react";
import { getDb } from "@/db";
import { profiles, restaurants, visits } from "@/db/schema";

export const getJournal = cache(async () => {
  if (!process.env.DATABASE_URL) return null;
  const db = getDb();
  const [allRestaurants, allVisits, allProfiles] = await Promise.all([
    db.select().from(restaurants).orderBy(restaurants.name),
    db.select().from(visits),
    db.select().from(profiles).orderBy(profiles.name),
  ]);
  return {
    restaurants: allRestaurants,
    visits: allVisits,
    profiles: allProfiles,
  };
});

export type Journal = NonNullable<Awaited<ReturnType<typeof getJournal>>>;
