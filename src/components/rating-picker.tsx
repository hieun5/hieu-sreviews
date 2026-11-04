"use client";
import { useState } from "react";
import { ratingMood } from "./rating-mood";
export function RatingPicker({
  initialValue,
  error,
  value: controlledValue,
  onChange,
}: {
  initialValue: string;
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(initialValue);
  const value = controlledValue ?? localValue;
  function setValue(next: string) {
    if (onChange) onChange(next);
    else setLocalValue(next);
  }
  const mood = ratingMood(value);
  return (
    <div className="rating-picker">
      <div className="rating-heading">
        <label htmlFor="rating" className="ticket-label">
          Your rating
        </label>
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
            aria-invalid={!!error}
            aria-describedby={
              error ? "rating-help rating-error" : "rating-help"
            }
          />
          <span>/ 10</span>
        </div>
      </div>
      <div className="rating-shortcuts" role="group" aria-label="Quick ratings">
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
      <p id="rating-help" className="rating-feedback" aria-live="polite">
        {mood.tone === "unrated" ? "" : `${value} / 10 · ${mood.label}`}
      </p>
      {error ? (
        <p id="rating-error" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
