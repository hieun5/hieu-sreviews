// The single source of truth for selectable profiles and their avatars.
// Keep IDs stable when changing names. Run npm run db:seed after edits.
export const friendProfiles = [
  { id: "hieu", name: "Hieu", initials: "H", avatar: "persimmon" },
  { id: "ky-an", name: "Ky-An", initials: "KA", avatar: "olive" },
  { id: "vinh", name: "Vinh", initials: "V", avatar: "honey" },
  { id: "nick", name: "Nick", initials: "N", avatar: "clay" },
  { id: "mai-han", name: "Mai-Han", initials: "MH", avatar: "rose" },
] as const;

export type FriendProfile = (typeof friendProfiles)[number];
export function findProfile(id?: string) {
  return friendProfiles.find((profile) => profile.id === id);
}
