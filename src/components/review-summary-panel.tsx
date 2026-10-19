"use client";

import { useState } from "react";
import {
  reviewSummaryResponseSchema,
  type ReviewSummaryResponse,
} from "@/contracts/review-summaries";
import { ApiRequestError, requestJson } from "@/lib/client/api";

type SummaryData = ReviewSummaryResponse["data"];
type ReviewReference = { id: string; profileId: string; visitDate: string };

export function ReviewSummaryPanel({
  restaurantId,
  reviews,
  profileNames,
}: {
  restaurantId: string;
  reviews: ReviewReference[];
  profileNames: Record<string, string>;
}) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await requestJson(
        `/api/restaurants/${restaurantId}/summary`,
        { method: "POST" },
        (value) => reviewSummaryResponseSchema.parse(value),
      );
      setSummary(response.data);
    } catch (caught) {
      if (
        caught instanceof ApiRequestError &&
        caught.body.code === "SUMMARY_MODEL_UNCONFIGURED"
      ) {
        setError(
          "AI summaries aren’t configured yet. Add a server-side model and credential to enable them.",
        );
      } else {
        setError(
          caught instanceof Error
            ? caught.message
            : "The summary could not be generated.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const references = new Map(reviews.map((review) => [review.id, review]));
  return (
    <section className="panel mb-8 p-5 sm:p-6" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="muted mb-1 text-xs">Grounded in saved reviews</p>
          <h2 className="section-title mb-1">Review themes</h2>
          <p className="muted mb-0 text-xs">
            A summary needs at least three written reviews from two people. Each
            claim links to its supporting visit.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => void generate()}
        >
          {busy
            ? "Working…"
            : summary?.status === "generating"
              ? "Check summary"
              : "Summarize reviews"}
        </button>
      </div>
      {error ? (
        <p className="notice notice-error mt-4 mb-0" role="alert">
          {error}
        </p>
      ) : null}
      {summary?.status === "insufficient-reviews" ? (
        <p role="status" className="notice mt-4 mb-0">
          There are {summary.sourceReviewCount} eligible written reviews from{" "}
          {summary.profileCount}{" "}
          {summary.profileCount === 1 ? "person" : "people"}. Add reviews from
          at least two people to generate themes.
        </p>
      ) : null}
      {summary?.status === "generating" ? (
        <p role="status" className="notice mt-4 mb-0">
          A summary is being generated. Check again in a moment.
        </p>
      ) : null}
      {summary?.status === "ready" ? (
        <div className="mt-5 space-y-4">
          <p className="muted mb-0 text-xs">
            Based on {summary.sourceReviewCount} reviews from{" "}
            {summary.profileCount} people
            {summary.cached ? " · saved summary" : " · just generated"}. These
            are themes, not ratings or recommendations.
          </p>
          <ul className="space-y-4">
            {summary.claims.map((claim, index) => (
              <li
                key={`${claim.text}-${index}`}
                className="border-t border-line pt-4"
              >
                <p className="mb-2 text-sm">{claim.text}</p>
                <p className="muted mb-0 flex flex-wrap gap-x-2 gap-y-1 text-[11px]">
                  <span>Supported by</span>
                  {claim.supportingReviewIds.map((id) => {
                    const review = references.get(id);
                    return review ? (
                      <a
                        key={id}
                        href={`#visit-${id}`}
                        className="text-accent underline"
                      >
                        {profileNames[review.profileId] ?? "Reviewer"} ·{" "}
                        {review.visitDate}
                      </a>
                    ) : (
                      <span key={id}>Review {id.slice(0, 8)}</span>
                    );
                  })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
