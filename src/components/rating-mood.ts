// Presentation only. These reactions never change stored ratings or aggregates.
export function ratingMood(value: string | number | null | undefined) {
  const score =
    value === null || value === undefined || value === "" ? NaN : Number(value);
  if (!Number.isFinite(score) || score < 1 || score > 10) {
    return { emoji: "🤔", label: "Pick your score", tone: "unrated" };
  }
  if (score < 4) return { emoji: "😬", label: "Hard pass", tone: "pass" };
  if (score < 6) return { emoji: "😐", label: "It’s fine", tone: "okay" };
  if (score < 8) return { emoji: "🙂", label: "Would go back", tone: "good" };
  if (score < 9) return { emoji: "😋", label: "So good", tone: "great" };
  return { emoji: "🤌", label: "No notes", tone: "favorite" };
}
