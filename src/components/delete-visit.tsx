"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { visitDeleteResponseSchema } from "@/contracts/journal";
import { requestJson } from "@/lib/client/api";

export function DeleteVisit({ id, date }: { id: string; date: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (pending) return;
    if (
      !window.confirm(
        `Delete your visit from ${date}? Your current rating will be recalculated from the remaining visits.`,
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await requestJson(
        `/api/visits/${id}`,
        { method: "DELETE" },
        (value) => visitDeleteResponseSchema.parse(value),
      );
      router.push(`/places/${response.data.restaurantId}?saved=delete`);
      router.refresh();
    } catch {
      setError("The visit could not be deleted. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={remove}
        className="inline-flex min-h-9 items-center gap-1.5 rounded px-2 text-xs text-[#963d2d] hover:bg-[#f8e9df] disabled:opacity-60"
      >
        <Trash2 size={13} aria-hidden="true" />
        {pending ? "Deleting..." : "Delete"}
      </button>
      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
