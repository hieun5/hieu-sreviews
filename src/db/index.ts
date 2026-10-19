import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  return drizzle(neon(process.env.DATABASE_URL), { schema });
}

let database: ReturnType<typeof createDatabase> | undefined;
export function getDb() {
  return (database ??= createDatabase());
}
