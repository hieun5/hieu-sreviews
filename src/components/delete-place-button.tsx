"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { restaurantDeleteResponseSchema } from "@/contracts/journal";
import { ApiRequestError, requestJson } from "@/lib/client/api";

export function DeletePlaceButton({
  id,
  name,
  visitCount,
}: {
  id: string;
  name: string;
  visitCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    const history = `${visitCount} ${visitCount === 1 ? "visit" : "visits"}`;
    const detail = visitCount
      ? ` This permanently deletes ${history}, including ratings, reviews, spending entries, and saved recommendation results.`
      : "";
    if (!window.confirm(`Remove ${name}?${detail} This can’t be undone.`))
      return;

    setPending(true);
    setError("");
    try {
      await requestJson(
        `/api/restaurants/${id}`,
        { method: "DELETE" },
        (value) => restaurantDeleteResponseSchema.parse(value),
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Couldn’t remove this place. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="place-remove-wrap">
      <button
        type="button"
        className="place-remove-button"
        aria-label={`Remove ${name}`}
        title="Remove place"
        disabled={pending}
        onClick={remove}
      >
        <X size={17} aria-hidden="true" />
      </button>
      {error ? (
        <p className="place-remove-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
