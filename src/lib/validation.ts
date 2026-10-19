import Decimal from "decimal.js";
import { z } from "zod";
import { todayInTimeZone, validCalendarDate } from "./dates";

const blankToNull = (value: string) => value.trim() || null;
const ratingSchema = z
  .string()
  .trim()
  .min(1, "Enter a rating.")
  .max(32)
  .regex(/^\d+(?:\.\d+)?$/, "Enter a rating from 1 to 10.")
  .refine((value) => {
    try {
      const rating = new Decimal(value);
      return rating.gte(1) && rating.lte(10);
    } catch {
      return false;
    }
  }, "Rating must be between 1 and 10.")
  .transform((value) => new Decimal(value).toString());

export const spendingSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value),
    "Use a nonnegative USD amount with at most two decimal places (maximum 9,999,999,999.99).",
  )
  .transform((value) => (value === "" ? null : new Decimal(value).toFixed(2)));

export function makeVisitSchema(today = todayInTimeZone()) {
  return z.object({
    restaurantId: z.uuid("Choose a saved place."),
    rating: ratingSchema,
    visitDate: z
      .string()
      .refine(validCalendarDate, "Enter a valid visit date.")
      .refine((value) => value <= today, "Visit date cannot be in the future."),
    reviewText: z
      .string()
      .trim()
      .max(2000, "Keep your review to 2,000 characters.")
      .transform(blankToNull),
    orderDescription: z
      .string()
      .trim()
      .max(300, "Keep your order to 300 characters.")
      .transform(blankToNull),
    amountSpent: spendingSchema,
  });
}

export const restaurantSchema = z.object({
  name: z.string().trim().min(1, "Enter the place name.").max(160),
  address: z.string().trim().min(1, "Enter an address.").max(300),
  kind: z.enum(["restaurant", "cafe"]),
  cuisines: z
    .string()
    .max(500)
    .transform((value) => [
      ...new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ])
    .refine(
      (items) => items.length <= 8 && items.every((item) => item.length <= 60),
      "Use up to eight categories, each at most 60 characters.",
    ),
  priceTier: z
    .enum(["", "1", "2", "3", "4"])
    .transform((value) => (value === "" ? null : Number(value))),
});

export function normalizePlace(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function formValues(data: FormData, keys: string[]) {
  return Object.fromEntries(
    keys.map((key) => [key, String(data.get(key) ?? "")]),
  );
}
