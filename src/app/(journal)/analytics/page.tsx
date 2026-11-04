import { PageHeader, DatabaseSetup } from "@/components/ui";
import { DashboardAnalytics } from "@/components/dashboard-analytics";
import { requireProfile } from "@/lib/profile";

export const metadata = { title: "Our food stats" };
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [profile, params] = await Promise.all([requireProfile(), searchParams]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Our food stats" />
      {process.env.DATABASE_URL ? (
        <DashboardAnalytics
          searchParams={params}
          selectedProfileId={profile.id}
        />
      ) : (
        <DatabaseSetup />
      )}
    </div>
  );
}
