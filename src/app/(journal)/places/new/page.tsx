import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RestaurantForm } from "@/components/restaurant-form";
import { DatabaseSetup, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/profile";

export const metadata = { title: "Add a place" };

export default async function NewPlacePage() {
  await requireProfile();
  return (
    <div className="max-w-3xl">
      <Link
        href="/places"
        className="mb-6 inline-flex items-center gap-2 text-xs text-accent"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Places
      </Link>
      <PageHeader title="Add a place" />
      {process.env.DATABASE_URL ? <RestaurantForm /> : <DatabaseSetup />}
    </div>
  );
}
