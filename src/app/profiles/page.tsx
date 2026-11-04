import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { selectProfile } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { Brand } from "@/components/ui";
import { friendProfiles } from "@/config/profiles";
import { getSelectedProfile } from "@/lib/profile";

export const metadata = { title: "Who’s reviewing?" };
export default async function ProfilesPage() {
  const selected = await getSelectedProfile();
  return (
    <main className="profile-page">
      <div className="flex items-center justify-between gap-4">
        <Brand />
        {selected ? (
          <Link href="/" className="btn btn-quiet">
            Back to the table <ArrowRight size={15} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <section className="profile-welcome">
        <h1>Who’s reviewing?</h1>
        <div className="profile-grid">
          {friendProfiles.map((profile) => (
            <form key={profile.id} action={selectProfile}>
              <button
                name="profileId"
                value={profile.id}
                className={`profile-card profile-choice-${profile.avatar}`}
                aria-label={`Select ${profile.name}`}
                aria-current={profile.id === selected?.id ? "true" : undefined}
              >
                <Avatar profile={profile} size={68} />
                <span>{profile.name}</span>
                {profile.id === selected?.id ? (
                  <Check
                    size={16}
                    className="absolute right-3 top-3 text-accent"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}
