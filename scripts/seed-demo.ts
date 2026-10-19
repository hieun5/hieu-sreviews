import { seedProfiles } from "../src/db/seed-profiles";
import { restaurants, visits } from "../src/db/schema";
import { normalizePlace } from "../src/lib/validation";
import { scriptDatabase } from "./database";

// Explicitly fictional, clearly marked, and never run by db:seed or the app.
const cafeId = "00000000-0000-4000-8000-000000000001";
const restaurantId = "00000000-0000-4000-8000-000000000002";

async function main() {
  const { db, close } = scriptDatabase();
  try {
    await db.transaction(async (tx) => {
      await seedProfiles(tx);
      const places = [
        {
          id: cafeId,
          name: "[DEMO — FICTIONAL] Example Café",
          address: "Fictional demo address, not a real listing",
          kind: "cafe",
          cuisines: ["Coffee", "Pastries"],
        },
        {
          id: restaurantId,
          name: "[DEMO — FICTIONAL] Example Noodle Table",
          address: "Another fictional demo address, not a real listing",
          kind: "restaurant",
          cuisines: ["Vietnamese", "Noodles"],
        },
      ];
      await tx
        .insert(restaurants)
        .values(
          places.map((place) => ({
            ...place,
            normalizedName: normalizePlace(place.name),
            normalizedAddress: normalizePlace(place.address),
          })),
        )
        .onConflictDoNothing();
      await tx
        .insert(visits)
        .values([
          {
            id: "00000000-0000-4000-8000-000000000011",
            restaurantId: cafeId,
            profileId: "hieu",
            rating: "7.5",
            visitDate: "2025-01-10",
            reviewText:
              "[DEMO — FICTIONAL] Example review for local exploration only.",
            amountSpent: "12.50",
            createdAt: "2025-01-10T18:00:00Z",
          },
          {
            id: "00000000-0000-4000-8000-000000000012",
            restaurantId: cafeId,
            profileId: "hieu",
            rating: "8.5",
            visitDate: "2025-02-10",
            reviewText: "[DEMO — FICTIONAL] Example return visit.",
            createdAt: "2025-02-10T18:00:00Z",
          },
          {
            id: "00000000-0000-4000-8000-000000000013",
            restaurantId: cafeId,
            profileId: "ky-an",
            rating: "9",
            visitDate: "2025-02-11",
            reviewText: "[DEMO — FICTIONAL] Example friend review.",
            amountSpent: "15.00",
            createdAt: "2025-02-11T18:00:00Z",
          },
          {
            id: "00000000-0000-4000-8000-000000000014",
            restaurantId,
            profileId: "vinh",
            rating: "8",
            visitDate: "2025-02-12",
            reviewText: "[DEMO — FICTIONAL] Example restaurant review.",
            amountSpent: "24.00",
            createdAt: "2025-02-12T18:00:00Z",
          },
        ])
        .onConflictDoNothing();
    });
    console.log(
      "Clearly labeled fictional demo data added. Never present these records as real listings or reviews.",
    );
  } finally {
    await close();
  }
}

main().catch(() => {
  console.error(
    "Demo seed failed. Check the database connection and run migrations first.",
  );
  process.exitCode = 1;
});
