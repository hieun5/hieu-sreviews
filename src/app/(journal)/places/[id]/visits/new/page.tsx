import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { VisitForm } from "@/components/visit-form";
import { DatabaseSetup, PageHeader } from "@/components/ui";
import { getJournal } from "@/lib/data";
import { DEFAULT_TIME_ZONE, todayInTimeZone } from "@/lib/dates";
import { requireProfile } from "@/lib/profile";

export const metadata = { title: "Log a visit" };

export default async function NewVisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const journal = await getJournal();
  if (!journal) return <DatabaseSetup />;
  const place = journal.restaurants.find((item) => item.id === id);
  if (!place) notFound();
  const today = todayInTimeZone(
    new Date(),
    process.env.APP_TIME_ZONE || DEFAULT_TIME_ZONE,
  );
  return (
    <div className="max-w-3xl">
      <Link
        href={`/places/${id}`}
        className="mb-6 inline-flex items-center gap-2 text-xs text-accent"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {place.name}
      </Link>
      <PageHeader title="Log a visit" />
      <VisitForm restaurantId={id} profileName={profile.name} today={today} />
    </div>
  );
}
