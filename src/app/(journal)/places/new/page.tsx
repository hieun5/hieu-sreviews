import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MealTicket } from "@/components/meal-ticket";
import { DEFAULT_TIME_ZONE, todayInTimeZone } from "@/lib/dates";
import { requireProfile } from "@/lib/profile";
import { getJournal } from "@/lib/data";

export const metadata = { title: "Add a place" };
export default async function NewPlacePage() {
  const [profile, journal] = await Promise.all([
    requireProfile(),
    getJournal(),
  ]);
  const today = todayInTimeZone(
    new Date(),
    process.env.APP_TIME_ZONE || DEFAULT_TIME_ZONE,
  );
  return (
    <div className="home-journal">
      <Link href="/places" className="text-link mb-5">
        <ArrowLeft size={15} aria-hidden="true" />
        Places
      </Link>
      <div className="meal-intro">
        <h1>A new place at the table</h1>
        <p>Save the spot. Tell us how it was.</p>
      </div>
      <MealTicket
        places={
          journal?.restaurants.map(({ id, name, address, kind }) => ({
            id,
            name,
            address,
            kind,
          })) ?? []
        }
        selectedProfileId={profile.id}
        today={today}
        newPlace
      />
    </div>
  );
}
