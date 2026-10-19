import { seedProfiles } from "../src/db/seed-profiles";
import { scriptDatabase } from "./database";

async function main() {
  const { db, close } = scriptDatabase();
  try {
    await seedProfiles(db);
    console.log(
      "Profiles seeded. Existing visits and restaurants were preserved.",
    );
  } finally {
    await close();
  }
}

main().catch(() => {
  console.error(
    "Profile seed failed. Check the database connection and run migrations first.",
  );
  process.exitCode = 1;
});
