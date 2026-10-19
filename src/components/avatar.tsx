import type { FriendProfile } from "@/config/profiles";

export function Avatar({
  profile,
  size = 36,
}: {
  profile: Pick<FriendProfile, "initials" | "avatar" | "name">;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={`avatar avatar-${profile.avatar}${size >= 56 ? " avatar-expressive" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.31 }}
    >
      {size >= 56 ? (
        <>
          <svg
            viewBox="0 0 80 80"
            className="avatar-face"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M22 27q5-4 10 0m16 0q5-4 10 0"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <ellipse cx="28" cy="38" rx="3" ry="4" fill="currentColor" />
            {profile.avatar === "rose" || profile.avatar === "clay" ? (
              <path
                d="m48 37 9 2-9 3"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <ellipse cx="52" cy="38" rx="3" ry="4" fill="currentColor" />
            )}
            <path
              d="M32 49q8 9 16 0"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <ellipse
              cx="19"
              cy="46"
              rx="5"
              ry="3"
              fill="#F07B79"
              opacity=".6"
            />
            <ellipse
              cx="61"
              cy="46"
              rx="5"
              ry="3"
              fill="#F07B79"
              opacity=".6"
            />
          </svg>
          <span className="avatar-initials">{profile.initials}</span>
        </>
      ) : (
        profile.initials
      )}
    </span>
  );
}
