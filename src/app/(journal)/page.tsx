import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DatabaseSetup, EmptyState } from "@/components/ui";
import { MealTicket } from "@/components/meal-ticket";
import { VisitList } from "@/components/visit-list";
import { getJournal } from "@/lib/data";
import { requireProfile } from "@/lib/profile";
import { compareVisits } from "@/lib/ratings";
import { DEFAULT_TIME_ZONE, todayInTimeZone } from "@/lib/dates";

export default async function HomePage() {
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
      <div className="meal-intro">
        <h1>What did you eat?</h1>
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
      />
      <section className="around-table" aria-labelledby="around-table-title">
        <div className="section-heading">
          <h2 id="around-table-title" className="section-title">
            Around the table
          </h2>
          <Link href="/journal" className="text-link">
            See all <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        {!journal ? (
          <DatabaseSetup />
        ) : journal.visits.length ? (
          <VisitList
            allVisits={journal.visits}
            visits={[...journal.visits].sort(compareVisits).slice(0, 3)}
            profiles={journal.profiles}
            restaurants={journal.restaurants}
            selectedProfileId={profile.id}
            showPlace
          />
        ) : (
          <EmptyState
            title="First bite’s on you"
            description="Your friends’ meals and little reviews will show up here. Start with the ticket above."
          />
        )}
      </section>
    </div>
  );
}
