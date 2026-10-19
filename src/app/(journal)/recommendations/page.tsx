import { PageHeader } from "@/components/ui";
import { RecommendationPanel } from "@/components/recommendation-panel";
import { friendProfiles } from "@/config/profiles";
import { requireProfile } from "@/lib/profile";

export const metadata = { title: "Recommendations" };

export default async function RecommendationsPage() {
  const profile = await requireProfile();
  return (
    <>
      <PageHeader
        title="Recommendations"
        description="Choose who’s going, then find a familiar favorite or explore something new."
      />
      <RecommendationPanel
        profiles={friendProfiles.map(({ id, name }) => ({ id, name }))}
        selectedProfileId={profile.id}
      />
    </>
  );
}
