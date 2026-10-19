import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { selectProfile } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { Brand } from "@/components/ui";
import { FoodDoodle } from "@/components/food-doodle";
import { friendProfiles } from "@/config/profiles";
import { getSelectedProfile } from "@/lib/profile";

export const metadata = { title: "Hieu’s (who’s) reviewing" };

export default async function ProfilesPage() {
  const selected = await getSelectedProfile();
  return (
    <main className="profile-page">
      <div className="flex items-center justify-between gap-4">
        <Brand />
        {selected ? (
          <Link href="/" className="btn btn-quiet">
            Back
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <section className="flex flex-1 flex-col items-center justify-center py-14 text-center">
        <div className="profile-title">
          <FoodDoodle
            size={65}
            className="profile-doodle profile-doodle-left"
          />
          <h1 className="display mb-0 text-[clamp(30px,4vw,43px)]">
            Hieu’s <span className="who-note">(who’s)</span> reviewing
          </h1>
          <FoodDoodle
            kind="skewer"
            size={65}
            className="profile-doodle profile-doodle-right"
          />
        </div>
        <div className="profile-grid grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {friendProfiles.map((profile) => (
            <form key={profile.id} action={selectProfile}>
              <button
                name="profileId"
                value={profile.id}
                className={`profile-card profile-choice-${profile.avatar} relative flex w-full flex-col items-center px-4 py-7`}
                aria-label={`Select ${profile.name}`}
                aria-current={profile.id === selected?.id ? "true" : undefined}
              >
                <Avatar profile={profile} size={80} />
                <span className="mt-4 text-base font-bold">{profile.name}</span>
                {profile.id === selected?.id ? (
                  <Check
                    size={15}
                    className="absolute right-3 top-3 text-accent"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            </form>
          ))}
        </div>
        <p className="muted mt-6 max-w-lg text-xs">
          Profiles are shared selections, not secured accounts. Anyone with access to this journal can choose a profile.
        </p>
      </section>
    </main>
  );
}
