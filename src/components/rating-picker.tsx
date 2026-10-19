"use client";

import { useState } from "react";
import { ratingMood } from "./rating-mood";

export function RatingPicker({
  initialValue,
  error,
}: {
  initialValue: string;
  error?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const mood = ratingMood(value);

  return (
    <div>
      <label htmlFor="rating" className="field-label">
        Your rating <span className="text-accent">*</span>
      </label>
      <div className="rating-picker" data-mood={mood.tone}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rating-reaction" aria-hidden="true">
              {mood.emoji}
            </span>
            <div>
              <p
                className="mb-1 text-lg font-bold tracking-tight"
                aria-live="polite"
              >
                {mood.label}
              </p>
              <p id="rating-help" className="muted mb-0 text-xs">
                1–10. Decimals welcome.
              </p>
            </div>
          </div>
          <div className="rating-exact">
            <input
              id="rating"
              name="rating"
              type="number"
              inputMode="decimal"
              required
              min="1"
              max="10"
              step="any"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="—"
              aria-invalid={!!error}
              aria-describedby={
                error ? "rating-help rating-error" : "rating-help"
              }
            />
            <span className="text-sm text-muted">/ 10</span>
          </div>
        </div>
        <div
          className="rating-shortcuts"
          role="group"
          aria-label="Quick ratings"
        >
          {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
            <button
              key={score}
              type="button"
              className="rating-option"
              aria-label={`Set rating to ${score} out of 10`}
              aria-pressed={value !== "" && Number(value) === score}
              onClick={() => setValue(String(score))}
            >
              {score}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <p id="rating-error" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
