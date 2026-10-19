import { createRequire } from "node:module";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";

// @next/env is CommonJS; Node 24 does not reliably expose its named exports
// through ESM named-import detection, so load it through the CJS bridge.
const { loadEnvConfig } = createRequire(import.meta.url)("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

export function scriptDatabase() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      "Set DATABASE_URL in .env.local before running database commands.",
    );
  const client = postgres(url, { max: 1, prepare: false });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
