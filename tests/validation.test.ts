import { describe, expect, it } from "vitest";
import { todayInTimeZone } from "../src/lib/dates";
import {
  makeVisitSchema,
  normalizePlace,
  restaurantSchema,
  spendingSchema,
} from "../src/lib/validation";
import { placeA } from "./fixtures";

const schema = makeVisitSchema("2025-06-15");
const valid = {
  restaurantId: placeA,
  rating: "8.5",
  visitDate: "2025-06-15",
  reviewText: "",
  orderDescription: "",
  amountSpent: "",
};

describe("visit validation", () => {
  it.each(["1", "1.0", "10", "10.0", "8.04"])("accepts rating %s", (rating) => {
    expect(schema.safeParse({ ...valid, rating }).success).toBe(true);
  });
  it.each(["", "0.9", "10.01", "-1", "NaN", "Infinity", "1e1", "8abc"])(
    "rejects rating %s",
    (rating) => {
      expect(schema.safeParse({ ...valid, rating }).success).toBe(false);
    },
  );
  it("requires restaurant, rating, and date; profile is supplied by the server cookie", () => {
    expect(schema.safeParse({ ...valid, restaurantId: "" }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...valid, visitDate: "" }).success).toBe(false);
  });
  it.each(["2025-06-16", "2025-02-30", "2025-2-01", "not-a-date"])(
    "rejects future or invalid date %s",
    (visitDate) => {
      expect(schema.safeParse({ ...valid, visitDate }).success).toBe(false);
    },
  );
  it("accepts a real leap day and rejects a false one", () => {
    expect(
      schema.safeParse({ ...valid, visitDate: "2024-02-29" }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ ...valid, visitDate: "2025-02-29" }).success,
    ).toBe(false);
  });
  it("enforces review/order limits and preserves null for absent optional fields", () => {
    expect(
      schema.safeParse({
        ...valid,
        reviewText: "x".repeat(2000),
        orderDescription: "x".repeat(300),
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ ...valid, reviewText: "x".repeat(2001) }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...valid, orderDescription: "x".repeat(301) }).success,
    ).toBe(false);
    expect(schema.parse(valid)).toMatchObject({
      reviewText: null,
      orderDescription: null,
      amountSpent: null,
    });
  });
  it("keeps monetary values as decimal strings, including a genuine zero", () => {
    expect(spendingSchema.parse("19.99")).toBe("19.99");
    expect(spendingSchema.parse("0")).toBe("0.00");
    expect(spendingSchema.parse("0.10")).toBe("0.10");
    expect(spendingSchema.parse("")).toBeNull();
  });
  it.each(["-0.01", "1.001", "1e3", "NaN", "10000000000.00"])(
    "rejects invalid spending %s",
    (amount) => {
      expect(spendingSchema.safeParse(amount).success).toBe(false);
    },
  );
  it("uses the shared calendar timezone at midnight boundaries", () => {
    expect(
      todayInTimeZone(new Date("2025-06-16T02:00:00Z"), "America/Los_Angeles"),
    ).toBe("2025-06-15");
  });
});

describe("manual places", () => {
  it("normalizes accents, punctuation, casing, and whitespace for duplicate checks", () => {
    expect(normalizePlace("  CAFÉ  Moon! ")).toBe(normalizePlace("Cafe moon"));
    expect(normalizePlace("123 Main St., Seattle")).toBe(
      normalizePlace("123 MAIN ST Seattle"),
    );
  });
  it("requires name and address and separates listed price from spending", () => {
    const place = {
      name: "Cafe",
      address: "123 Main",
      kind: "cafe",
      cuisines: "Coffee, Coffee, Brunch",
      priceTier: "",
    };
    expect(restaurantSchema.parse(place)).toMatchObject({
      priceTier: null,
      cuisines: ["Coffee", "Brunch"],
    });
    expect(restaurantSchema.safeParse({ ...place, name: " " }).success).toBe(
      false,
    );
    expect(restaurantSchema.safeParse({ ...place, address: "" }).success).toBe(
      false,
    );
    expect(
      restaurantSchema.safeParse({ ...place, priceTier: "5" }).success,
    ).toBe(false);
  });
});
