import type { Journal } from "../src/lib/data";

export const placeA = "10000000-0000-4000-8000-000000000001";
export const placeB = "10000000-0000-4000-8000-000000000002";

export function visit(
  overrides: Partial<Journal["visits"][number]> = {},
): Journal["visits"][number] {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    restaurantId: placeA,
    profileId: "hieu",
    rating: "8",
    visitDate: "2025-01-01",
    createdAt: "2025-01-01T18:00:00Z",
    updatedAt: "2025-01-01T18:00:00Z",
    reviewText: null,
    orderDescription: null,
    amountSpent: null,
    currency: "USD",
    ...overrides,
  };
}

export function journalFixture(rows = [visit()]): Journal {
  return {
    profiles: [
      { id: "hieu", name: "Hieu", initials: "H", avatar: "persimmon" },
      { id: "nick", name: "Nick", initials: "N", avatar: "clay" },
    ],
    restaurants: [
      {
        id: placeA,
        name: "Test café",
        address: "Test address A",
        kind: "cafe",
        cuisines: ["Coffee", "Pastries"],
        priceTier: null,
        normalizedName: "test cafe",
        normalizedAddress: "test address a",
        provider: null,
        providerPlaceId: null,
        createdAt: "2025-01-01T00:00:00Z",
      },
      {
        id: placeB,
        name: "Test restaurant",
        address: "Test address B",
        kind: "restaurant",
        cuisines: ["Vietnamese"],
        priceTier: 2,
        normalizedName: "test restaurant",
        normalizedAddress: "test address b",
        provider: null,
        providerPlaceId: null,
        createdAt: "2025-01-01T00:00:00Z",
      },
    ],
    visits: rows,
  };
}
