import { describe, expect, it } from "vitest";
import {
  emptyMealFields,
  mealDraftKey,
  MEAL_DRAFT_MAX_AGE,
  parseMealDraft,
  readMealDraftSnapshot,
  writeMealDraft,
  removeMealDraft,
  type MealDraft,
} from "../src/lib/client/meal-draft";

const now = Date.UTC(2026, 10, 2);
const draft: MealDraft = {
  version: 1,
  updatedAt: now,
  reviewerId: "hieu",
  query: "A café",
  placeId: null,
  adding: true,
  fields: {
    ...emptyMealFields("2026-11-02"),
    rating: "8.25",
    reviewText: "Remember the noodles",
    amountSpent: "0",
    kind: "cafe",
  },
};

describe("recoverable meal drafts", () => {
  it("preserves reviewer, decimal score, zero spending, and new-place details", () => {
    expect(parseMealDraft(JSON.stringify(draft), now)).toEqual(draft);
  });
  it("preserves a partial review without treating it as a completed API request", () => {
    const partial = {
      ...draft,
      fields: { ...draft.fields, rating: "", amountSpent: "12.", visitDate: "" },
    };
    expect(parseMealDraft(JSON.stringify(partial), now)).toEqual(partial);
  });
  it("keeps existing restaurant identity for a return visit", () => {
    const existing = {
      ...draft,
      adding: false,
      placeId: "10000000-0000-4000-8000-000000000001",
    };
    expect(parseMealDraft(JSON.stringify(existing), now)?.placeId).toBe(
      existing.placeId,
    );
  });
  it.each([
    null,
    "{broken",
    "null",
    JSON.stringify({ ...draft, version: 2 }),
    JSON.stringify({ ...draft, reviewerId: "unknown" }),
    JSON.stringify({ ...draft, placeId: "invalid" }),
    JSON.stringify({
      ...draft,
      fields: { ...draft.fields, reviewText: "x".repeat(2001) },
    }),
  ])("ignores corrupt or incompatible data: %s", (raw) => {
    expect(parseMealDraft(raw, now)).toBeNull();
  });
  it("expires drafts after seven days and rejects future timestamps", () => {
    expect(
      parseMealDraft(JSON.stringify(draft), now + MEAL_DRAFT_MAX_AGE),
    ).not.toBeNull();
    expect(
      parseMealDraft(JSON.stringify(draft), now + MEAL_DRAFT_MAX_AGE + 1),
    ).toBeNull();
    expect(
      parseMealDraft(
        JSON.stringify({ ...draft, updatedAt: now + 60_001 }),
        now,
      ),
    ).toBeNull();
  });
  it("separates the home review and new-place drafts", () => {
    expect(mealDraftKey(false)).not.toBe(mealDraftKey(true));
  });
  it("writes, recovers and removes a draft without server storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
    const key = mealDraftKey(false);
    expect(writeMealDraft(key, draft, storage)).toBe(true);
    expect(parseMealDraft(readMealDraftSnapshot(key, storage), now)).toEqual(
      draft,
    );
    expect(removeMealDraft(key, storage)).toBe(true);
    expect(readMealDraftSnapshot(key, storage)).toBeNull();
  });
  it("does not break meal logging when storage is blocked or full", () => {
    const fail = () => {
      throw new Error("Storage unavailable");
    };
    const storage = { getItem: fail, setItem: fail, removeItem: fail };
    expect(readMealDraftSnapshot("draft", storage)).toBeNull();
    expect(writeMealDraft("draft", draft, storage)).toBe(false);
    expect(removeMealDraft("draft", storage)).toBe(false);
    expect(readMealDraftSnapshot("draft")).toBeNull();
  });
});
