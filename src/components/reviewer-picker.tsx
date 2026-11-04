"use client";

import { Check } from "lucide-react";
import { Avatar } from "./avatar";
import { friendProfiles } from "@/config/profiles";

export function ReviewerPicker({
  selectedId,
  onSelect,
  disabled = false,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="reviewer-picker" disabled={disabled}>
      <legend className="section-title">Who’s reviewing?</legend>
      <div className="reviewer-options">
        {friendProfiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            className="reviewer-option"
            aria-pressed={selectedId === profile.id}
            aria-label={`Review as ${profile.name}`}
            onClick={() => onSelect(profile.id)}
          >
            <span className="reviewer-avatar">
              <Avatar profile={profile} size={56} />
              {selectedId === profile.id ? (
                <span className="reviewer-check">
                  <Check size={13} strokeWidth={3} />
                </span>
              ) : null}
            </span>
            <span>{profile.name}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
