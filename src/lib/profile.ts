import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findProfile } from "@/config/profiles";

export const PROFILE_COOKIE = "journal_profile";
export const getSelectedProfile = cache(async () =>
  findProfile((await cookies()).get(PROFILE_COOKIE)?.value),
);

export async function requireProfile() {
  const profile = await getSelectedProfile();
  if (!profile) redirect("/profiles");
  return profile;
}
