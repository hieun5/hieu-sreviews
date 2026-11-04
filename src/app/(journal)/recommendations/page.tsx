import { PageHeader } from "@/components/ui";
import { RecommendationPanel } from "@/components/recommendation-panel";
import { friendProfiles } from "@/config/profiles";
import { requireProfile } from "@/lib/profile";

export const metadata = { title: "Pick a place" };

export default async function RecommendationsPage() {
  const profile = await requireProfile();
  return (
    <>
      <PageHeader title="Where are we eating?" />
      <RecommendationPanel
        profiles={friendProfiles.map(({ id, name }) => ({ id, name }))}
        selectedProfileId={profile.id}
      />
    </>
  );
}
