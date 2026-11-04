"use client";

import Link from "next/link";
import { Search, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import {
  recommendationResponseSchema,
  type RecommendationRun,
} from "@/contracts/recommendations";
import { requestJson } from "@/lib/client/api";

type ProfileOption = { id: string; name: string };
export function RecommendationPanel({
  profiles,
  selectedProfileId,
}: {
  profiles: ProfileOption[];
  selectedProfileId: string;
}) {
  const [attendees, setAttendees] = useState<string[]>([selectedProfileId]);
  const [run, setRun] = useState<RecommendationRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creating = useRef(false);

  async function loadRun(id: string) {
    const response = await requestJson(
      `/api/recommendations/runs/${id}`,
      { method: "GET" },
      (value) => recommendationResponseSchema.parse(value),
    );
    setRun(response.data);
    setError(null);
  }

  function toggleAttendee(profileId: string) {
    setRun(null);
    setError(null);
    setAttendees((current) =>
      current.includes(profileId)
        ? current.filter((id) => id !== profileId)
        : current.length < 5
          ? [...current, profileId]
          : current,
    );
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating.current || attendees.length === 0) return;
    creating.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await requestJson(
        "/api/recommendations/runs",
        {
          method: "POST",
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            mode: "favorites",
            attendees,
            filters: {
              cuisine: null,
              kind: null,
              maxPriceTier: null,
              maxDistanceMeters: null,
              openNowOnly: false,
            },
            query: "",
            limit: 10,
          }),
        },
        (value) => recommendationResponseSchema.parse(value),
      );
      setRun(response.data);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Recommendations are unavailable.",
      );
    } finally {
      creating.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={create}
        className="panel recommendation-controls space-y-5 p-5 sm:p-7"
      >
        <fieldset disabled={busy}>
          <legend className="field-label">Who’s coming?</legend>
          <div className="flex flex-wrap gap-2">
            {profiles.map((profile) => (
              <label key={profile.id} className="recommendation-attendee">
                <input
                  type="checkbox"
                  checked={attendees.includes(profile.id)}
                  onChange={() => toggleAttendee(profile.id)}
                />
                {profile.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="pt-5">
          <button
            className="btn min-h-12 min-w-12"
            disabled={busy || attendees.length === 0}
            aria-label={busy ? "Finding places" : "Find places"}
            aria-busy={busy}
          >
            {busy ? (
              <LoaderCircle
                size={21}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Search size={21} aria-hidden="true" />
            )}
          </button>
        </div>
        {error ? (
          <p role="alert" className="notice notice-error mb-0">
            {error}
          </p>
        ) : null}
      </form>

      {run ? (
        <section aria-live="polite" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="section-title mb-0">Your picks</h2>
            <p className="muted mb-0 text-sm">
              For{" "}
              {run.attendees
                .map(
                  (id) =>
                    profiles.find((profile) => profile.id === id)?.name ??
                    "a friend",
                )
                .join(", ")}
            </p>
          </div>
          {run.status === "unavailable" ? (
            <div className="panel p-5" role="status">
              <p className="mb-1 font-semibold">
                Recommendations aren’t available right now.
              </p>
              <p className="muted mb-0 text-sm">
                {run.reason === "discovery-unconfigured"
                  ? "We can’t search for new places right now. Try Our Favorites to revisit a place from the journal."
                  : run.reason === "scorer-unconfigured"
                    ? "We can’t find group picks right now. Our saved places are still yours to browse."
                    : "Please try again in a little while."}
              </p>
            </div>
          ) : run.status === "empty" ? (
            <div className="panel p-5" role="status">
              No rated places yet. Add a few meals to the journal, then try
              again.
            </div>
          ) : run.status === "failed" ? (
            <div className="panel p-5" role="alert">
              We couldn’t find your picks. Please try again.
            </div>
          ) : null}
          {run.status === "pending" ? (
            <p className="notice" role="status">
              Still finding your picks.{" "}
              <button
                type="button"
                className="text-accent underline"
                onClick={() =>
                  void loadRun(run.id).catch(() =>
                    setError("Couldn’t load your picks. Try again."),
                  )
                }
              >
                Check picks
              </button>
            </p>
          ) : null}
          {run.results.map((result) => {
            const title =
              result.display.status === "available"
                ? result.display.source === "journal"
                  ? result.display.restaurant.name
                  : result.display.candidate.name
                : "Place details unavailable";
            return (
              <article key={result.id} className="panel p-5 sm:p-6">
                <p className="mb-1 text-xs text-muted">Pick {result.rank}</p>
                <h3 className="mb-2 text-lg font-semibold">
                  {result.restaurantId ? (
                    <Link
                      className="text-accent underline"
                      href={`/places/${result.restaurantId}`}
                    >
                      {title}
                    </Link>
                  ) : (
                    title
                  )}
                </h3>
                <p className="mb-0 text-sm font-semibold">
                  Match {Math.round(Number(result.preferenceScore))} / 100
                </p>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
