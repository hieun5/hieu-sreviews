import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { friendProfiles } from "../config/profiles";
import { profiles } from "./schema";

export async function seedProfiles(
  db: Pick<PgDatabase<PgQueryResultHKT>, "insert">,
) {
  await db
    .insert(profiles)
    .values(friendProfiles.map((profile) => ({ ...profile })))
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        name: sql`excluded.name`,
        initials: sql`excluded.initials`,
        avatar: sql`excluded.avatar`,
      },
    });
}
