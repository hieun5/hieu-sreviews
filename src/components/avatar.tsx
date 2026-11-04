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
      className={`avatar avatar-${profile.avatar}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {profile.initials}
    </span>
  );
}
