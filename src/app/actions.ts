"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { findProfile } from "@/config/profiles";
import { getDb } from "@/db";
import { profiles, restaurants, visits } from "@/db/schema";
import type { FormState } from "@/lib/action-state";
import { DEFAULT_TIME_ZONE, todayInTimeZone } from "@/lib/dates";
import { PROFILE_COOKIE, requireProfile } from "@/lib/profile";
import {
  formValues,
  makeVisitSchema,
  normalizePlace,
  restaurantSchema,
} from "@/lib/validation";

function refreshJournal() {
  revalidatePath("/", "layout");
}

export async function selectProfile(data: FormData) {
  const profile = findProfile(String(data.get("profileId") ?? ""));
  if (!profile) redirect("/profiles?error=invalid");
  (await cookies()).set(PROFILE_COOKIE, profile.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}

export async function createRestaurant(
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  await requireProfile();
  const values = formValues(data, [
    "name",
    "address",
    "kind",
    "cuisines",
    "priceTier",
  ]);
  const parsed = restaurantSchema.safeParse(values);
  if (!parsed.success)
    return {
      values,
      error: "Check the highlighted fields.",
      fields: z.flattenError(parsed.error).fieldErrors,
    };
  if (!process.env.DATABASE_URL)
    return {
      values,
      error: "The journal database has not been connected yet.",
    };
  let restaurantId: string;
  try {
    const db = getDb();
    const normalizedName = normalizePlace(parsed.data.name);
    const normalizedAddress = normalizePlace(parsed.data.address);
    if (!normalizedName || !normalizedAddress)
      return {
        values,
        error: "Use a name and address containing letters or numbers.",
      };
    const duplicates = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        address: restaurants.address,
      })
      .from(restaurants)
      .where(
        and(
          eq(restaurants.normalizedName, normalizedName),
          eq(restaurants.normalizedAddress, normalizedAddress),
        ),
      );
    if (duplicates.length && data.get("duplicateConfirmed") !== "on") {
      return {
        values,
        error:
          "This place may already be in the journal. Open the saved place, or confirm that this is a different place.",
        duplicates,
      };
    }
    const [created] = await db
      .insert(restaurants)
      .values({ ...parsed.data, normalizedName, normalizedAddress })
      .returning({ id: restaurants.id });
    restaurantId = created.id;
  } catch {
    return {
      values,
      error:
        "We couldn’t save this place. Check your connection and try again.",
    };
  }
  refreshJournal();
  redirect(`/places/${restaurantId}?saved=place`);
}

export async function saveVisit(
  visitId: string | null,
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  const values = formValues(data, [
    "restaurantId",
    "rating",
    "visitDate",
    "reviewText",
    "orderDescription",
    "amountSpent",
  ]);
  const today = todayInTimeZone(
    new Date(),
    process.env.APP_TIME_ZONE || DEFAULT_TIME_ZONE,
  );
  const parsed = makeVisitSchema(today).safeParse(values);
  if (!parsed.success)
    return {
      values,
      error: "Check the highlighted fields.",
      fields: z.flattenError(parsed.error).fieldErrors,
    };
  if (!process.env.DATABASE_URL)
    return {
      values,
      error: "The journal database has not been connected yet.",
    };
  try {
    const db = getDb();
    const [seededProfile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, profile.id));
    if (!seededProfile)
      return {
        values,
        error:
          "This profile is not available in the database yet. Ask the journal owner to run the profile seed.",
      };
    if (visitId) {
      if (!z.uuid().safeParse(visitId).success)
        return { values, error: "This visit could not be found." };
      // Convenience boundary only: profile selection does not verify identity.
      // Prevent an edit from moving a visit to another restaurant or profile.
      const { restaurantId, ...correction } = parsed.data;
      const updated = await db
        .update(visits)
        .set({ ...correction, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(visits.id, visitId),
            eq(visits.profileId, profile.id),
            eq(visits.restaurantId, restaurantId),
          ),
        )
        .returning({ id: visits.id });
      if (!updated.length)
        return {
          values,
          error: "This visit is no longer available for the selected profile.",
        };
    } else {
      await db.insert(visits).values({ ...parsed.data, profileId: profile.id });
    }
  } catch {
    return {
      values,
      error:
        "We couldn’t save this visit. Check your connection and try again.",
    };
  }
  refreshJournal();
  redirect(
    `/places/${parsed.data.restaurantId}?saved=${visitId ? "edit" : "visit"}`,
  );
}

export async function deleteVisit(data: FormData) {
  const profile = await requireProfile();
  const visitId = z.uuid().safeParse(data.get("visitId"));
  if (!visitId.success) redirect("/places");
  if (data.get("confirmed") !== "yes") redirect("/places");
  let restaurantId: string | undefined;
  try {
    const deleted = await getDb()
      .delete(visits)
      .where(and(eq(visits.id, visitId.data), eq(visits.profileId, profile.id)))
      .returning({ restaurantId: visits.restaurantId });
    restaurantId = deleted[0]?.restaurantId;
  } catch {
    redirect("/places?error=delete");
  }
  refreshJournal();
  redirect(
    restaurantId
      ? `/places/${restaurantId}?saved=delete`
      : "/places?error=missing",
  );
}
