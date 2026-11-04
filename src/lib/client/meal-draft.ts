import { z } from "zod";
import { friendProfiles } from "@/config/profiles";

export const MEAL_DRAFT_EVENT = "meal-draft-change";
export const MEAL_DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const fieldsSchema = z.object({
  rating: z.string().max(30),
  reviewText: z.string().max(2000),
  visitDate: z.union([z.literal(""), z.iso.date()]),
  orderDescription: z.string().max(300),
  amountSpent: z.string().max(30),
  address: z.string().max(300),
  kind: z.enum(["restaurant", "cafe"]),
  cuisines: z.string().max(480),
  priceTier: z.enum(["", "1", "2", "3", "4"]),
});

const draftSchema = z.object({
  version: z.literal(1),
  updatedAt: z.number().int().nonnegative(),
  reviewerId: z.enum(friendProfiles.map(({ id }) => id)),
  query: z.string().max(160),
  placeId: z.uuid().nullable(),
  adding: z.boolean(),
  fields: fieldsSchema,
});

export type MealDraftFields = z.infer<typeof fieldsSchema>;
export type MealDraft = z.infer<typeof draftSchema>;

export function emptyMealFields(today: string): MealDraftFields {
  return {
    rating: "",
    reviewText: "",
    visitDate: today,
    orderDescription: "",
    amountSpent: "",
    address: "",
    kind: "restaurant",
    cuisines: "",
    priceTier: "",
  };
}

export function mealDraftKey(newPlace: boolean) {
  return `hieus-reviews:meal-draft:v1:${newPlace ? "new-place" : "journal"}`;
}

export function parseMealDraft(
  raw: string | null,
  now = Date.now(),
): MealDraft | null {
  if (!raw) return null;
  try {
    const result = draftSchema.safeParse(JSON.parse(raw));
    if (
      !result.success ||
      now - result.data.updatedAt > MEAL_DRAFT_MAX_AGE ||
      result.data.updatedAt > now + 60_000
    )
      return null;
    return result.data;
  } catch {
    return null;
  }
}

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readMealDraftSnapshot(
  key: string,
  storage?: DraftStorage,
): string | null {
  try {
    return (storage ?? window.localStorage).getItem(key);
  } catch {
    return null;
  }
}

export function writeMealDraft(
  key: string,
  draft: MealDraft,
  storage?: DraftStorage,
) {
  try {
    (storage ?? window.localStorage).setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function removeMealDraft(key: string, storage?: DraftStorage) {
  try {
    (storage ?? window.localStorage).removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function subscribeToMealDrafts(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(MEAL_DRAFT_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(MEAL_DRAFT_EVENT, notify);
  };
}
