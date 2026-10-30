import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RestaurantForm } from "@/components/restaurant-form";
import { DatabaseSetup, PageHeader } from "@/components/ui";
import { DEFAULT_TIME_ZONE, todayInTimeZone } from "@/lib/dates";
import { requireProfile } from "@/lib/profile";

export const metadata = { title: "Add a place" };

export default async function NewPlacePage() {
  const profile = await requireProfile();
  const today = todayInTimeZone(
    new Date(),
    process.env.APP_TIME_ZONE || DEFAULT_TIME_ZONE,
  );
  return (
    <div className="max-w-3xl">
      <Link
        href="/places"
        className="mb-6 inline-flex items-center gap-2 text-xs text-accent"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Places
      </Link>
      <PageHeader title="Add a place and log your visit" />
      {process.env.DATABASE_URL ? (
        <RestaurantForm profileName={profile.name} today={today} />
      ) : (
        <DatabaseSetup />
      )}
    </div>
  );
}
