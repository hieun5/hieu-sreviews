"use client";

import { useEffect, useMemo, useState } from "react";
import {
  recommendationListResponseSchema,
  recommendationResponseSchema,
  type RecommendationRun,
} from "@/contracts/recommendations";
import { requestJson } from "@/lib/client/api";

type ProfileOption = { id: string; name: string };
type RunOption = {
  id: string;
  mode: "favorites" | "new";
  status: RecommendationRun["status"];
  reason: string | null;
  createdAt: string;
  resultCount: number;
};

export function RecommendationPanel({
  profiles,
  selectedProfileId,
}: {
  profiles: ProfileOption[];
  selectedProfileId: string;
}) {
  const [mode, setMode] = useState<"favorites" | "new">("favorites");
  const [attendees, setAttendees] = useState<string[]>([selectedProfileId]);
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [kind, setKind] = useState("");
  const [price, setPrice] = useState("");
  const [limit, setLimit] = useState("10");
  const [run, setRun] = useState<RecommendationRun | null>(null);
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyResult, setBusyResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedName = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId)?.name,
    [profiles, selectedProfileId],
  );

  async function loadRun(id: string) {
    const response = await requestJson(
      `/api/recommendations/runs/${id}`,
      { method: "GET" },
      (value) => recommendationResponseSchema.parse(value),
    );
    setRun(response.data);
    setError(null);
  }

  useEffect(() => {
    let active = true;
    void requestJson(
      "/api/recommendations/runs?page=1&pageSize=10",
      { method: "GET" },
      (value) => recommendationListResponseSchema.parse(value),
    )
      .then((response) => {
        if (active) setRuns(response.data as RunOption[]);
      })
      .catch(() => {
        if (active) setRuns([]);
      });
    return () => {
      active = false;
    };
  }, []);

  function toggleAttendee(profileId: string) {
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
    setBusy(true);
    setError(null);
    try {
      const response = await requestJson(
        "/api/recommendations/runs",
        {
          method: "POST",
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            mode,
            attendees,
            filters: {
              cuisine: cuisine || null,
              kind: kind || null,
              maxPriceTier: price ? Number(price) : null,
              maxDistanceMeters: null,
              openNowOnly: false,
            },
            query: mode === "new" ? query : "",
            limit: Number(limit),
          }),
        },
        (value) => recommendationResponseSchema.parse(value),
      );
      setRun(response.data);
      setRuns((current) =>
        [
          {
            id: response.data.id,
            mode: response.data.mode,
            status: response.data.status,
            reason: response.data.reason,
            createdAt: response.data.createdAt,
            resultCount: response.data.results.length,
          },
          ...current.filter((item) => item.id !== response.data.id),
        ].slice(0, 10),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Recommendations are unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function choose(resultId: string, choice: "selected" | "dismissed") {
    if (!run) return;
    setBusyResult(resultId);
    setError(null);
    try {
      await requestJson(
        `/api/recommendations/runs/${run.id}/feedback`,
        {
          method: "POST",
          body: JSON.stringify({ resultId, choice }),
        },
        (value) => value,
      );
      await loadRun(run.id);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Feedback could not be saved.",
      );
    } finally {
      setBusyResult(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="panel space-y-5 p-5 sm:p-7">
        <div>
          <label htmlFor="recommendation-mode" className="field-label">
            Recommendation style
          </label>
          <select
            id="recommendation-mode"
            className="input"
            value={mode}
            onChange={(event) =>
              setMode(event.target.value as "favorites" | "new")
            }
          >
            <option value="favorites">
              Our Favorites — revisit places we know
            </option>
            <option value="new">Something New — discover a new place</option>
          </select>
        </div>
        <fieldset>
          <legend className="field-label">
            Who’s going? Choose up to five.
          </legend>
          <div className="flex flex-wrap gap-2">
            {profiles.map((profile) => (
              <label
                key={profile.id}
                className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-xs"
              >
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
        {mode === "new" ? (
          <div>
            <label htmlFor="new-query" className="field-label">
              What are you in the mood for?
            </label>
            <input
              id="new-query"
              className="input"
              value={query}
              maxLength={160}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Noodles, brunch, coffee…"
            />
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="recommendation-cuisine" className="field-label">
              Cuisine
            </label>
            <input
              id="recommendation-cuisine"
              className="input"
              value={cuisine}
              maxLength={60}
              onChange={(event) => setCuisine(event.target.value)}
              placeholder="Any"
            />
          </div>
          <div>
            <label htmlFor="recommendation-kind" className="field-label">
              Place type
            </label>
            <select
              id="recommendation-kind"
              className="input"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="">Any</option>
              <option value="restaurant">Restaurant</option>
              <option value="cafe">Café</option>
            </select>
          </div>
          <div>
            <label htmlFor="recommendation-price" className="field-label">
              Maximum price tier
            </label>
            <select
              id="recommendation-price"
              className="input"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            >
              <option value="">Any / unknown</option>
              <option value="1">$</option>
              <option value="2">$$</option>
              <option value="3">$$$</option>
              <option value="4">$$$$</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-28">
            <label htmlFor="recommendation-limit" className="field-label">
              Show
            </label>
            <select
              id="recommendation-limit"
              className="input"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
            >
              {[5, 10, 15, 20].map((count) => (
                <option key={count} value={count}>
                  {count} places
                </option>
              ))}
            </select>
          </div>
          <button className="btn" disabled={busy || attendees.length === 0}>
            {busy ? "Finding places…" : "Get recommendations"}
          </button>
        </div>
        <p className="muted mb-0 text-xs">
          Recommendations are preference indices from 0–100, not ratings or
          predictions. They use the current scores of the selected attendees.
        </p>
        {error ? (
          <p role="alert" className="notice notice-error mb-0">
            {error}
          </p>
        ) : null}
      </form>

      {runs.length ? (
        <section className="panel p-5">
          <h2 className="section-title">Recent runs</h2>
          <div className="flex flex-wrap gap-2">
            {runs.map((item) => (
              <button
                key={item.id}
                type="button"
                className="btn btn-quiet"
                onClick={() =>
                  void loadRun(item.id).catch((caught) =>
                    setError(caught.message),
                  )
                }
              >
                {item.mode === "favorites" ? "Favorites" : "Something New"} ·{" "}
                {new Date(item.createdAt).toLocaleDateString()} · {item.status}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {run ? (
        <section aria-live="polite" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="section-title mb-0">
              {run.mode === "favorites" ? "Our Favorites" : "Something New"}
            </h2>
            <span className="badge">
              {run.status}
              {run.reason ? ` · ${run.reason}` : ""}
            </span>
          </div>
          {run.status === "unavailable" ? (
            <div className="panel p-5" role="status">
              <p className="mb-1 font-semibold">
                Recommendations aren’t available right now.
              </p>
              <p className="muted mb-0 text-sm">
                {run.reason === "discovery-unconfigured"
                  ? "Live restaurant discovery is not configured. No sample or saved places were substituted."
                  : run.reason === "scorer-unconfigured"
                    ? "The recommendation scoring service is not connected yet."
                    : `Service state: ${run.reason ?? "unavailable"}.`}
              </p>
            </div>
          ) : run.status === "empty" ? (
            <div className="panel p-5" role="status">
              No places match these filters and attendee data.
            </div>
          ) : run.status === "failed" ? (
            <div className="panel p-5" role="alert">
              This run failed. {run.reason ?? "Try again with a new run."}
            </div>
          ) : null}
          {run.status === "pending" ? (
            <p className="notice" role="status">
              This run is still processing. Reload it from Recent runs in a
              moment.
            </p>
          ) : null}
          {run.results.map((result) => {
            const title =
              result.display.status === "available"
                ? result.display.source === "journal"
                  ? result.display.restaurant.name
                  : result.display.candidate.name
                : "Place details unavailable";
            const existingChoice = run.feedback.find(
              (item) =>
                item.profileId === selectedProfileId &&
                item.resultId === result.id,
            )?.choice;
            return (
              <article key={result.id} className="panel p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="mb-1 text-xs text-muted">
                      #{result.rank} · preference index
                    </p>
                    <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                    {result.display.status === "available" &&
                    result.display.source === "journal" ? (
                      <p className="muted mb-2 text-xs">
                        {result.display.restaurant.address}
                      </p>
                    ) : null}
                    {result.display.status === "available" &&
                    result.display.source === "provider" ? (
                      <p className="muted mb-2 text-xs">
                        {result.display.candidate.address} ·{" "}
                        {result.display.candidate.attribution.text}{" "}
                        <a
                          href={result.display.candidate.attribution.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent underline"
                        >
                          Source
                        </a>
                      </p>
                    ) : null}
                    {result.display.status === "unavailable" ? (
                      <p className="muted mb-2 text-xs">
                        {result.display.reason}
                      </p>
                    ) : null}
                    <p className="mb-0 text-sm font-semibold">
                      {result.preferenceScore} / 100
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={
                        existingChoice === "selected"
                          ? "btn"
                          : "btn btn-secondary"
                      }
                      disabled={
                        !run.attendees.includes(selectedProfileId) ||
                        !!busyResult
                      }
                      onClick={() => void choose(result.id, "selected")}
                    >
                      {busyResult === result.id
                        ? "Saving…"
                        : existingChoice === "selected"
                          ? "Selected"
                          : "Select"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-quiet"
                      disabled={
                        !run.attendees.includes(selectedProfileId) ||
                        !!busyResult
                      }
                      onClick={() => void choose(result.id, "dismissed")}
                    >
                      {existingChoice === "dismissed" ? "Dismissed" : "Dismiss"}
                    </button>
                  </div>
                </div>
                <ul className="mt-4 space-y-1 text-xs text-muted">
                  {result.explanations.map((explanation, index) => (
                    <li key={`${explanation.code}-${index}`}>
                      {explanation.message}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
          {!run.attendees.includes(selectedProfileId) ? (
            <p className="muted text-xs">
              {selectedName ?? "The selected profile"} isn’t an attendee on this
              run. Switch to an attendee profile to record feedback.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
