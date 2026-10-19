import { migrate } from "drizzle-orm/postgres-js/migrator";
import { scriptDatabase } from "./database";

async function main() {
  const { db, close } = scriptDatabase();
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Version-controlled SQL migrations applied.");
  } finally {
    await close();
  }
}

main().catch(() => {
  console.error(
    "Migration failed. Verify the Neon connection and inspect unapplied migrations. No credentials are printed.",
  );
  process.exitCode = 1;
});
