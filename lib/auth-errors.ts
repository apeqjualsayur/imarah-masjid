// Database and Supabase errors are matched to message keys under "errors" in
// messages/*.json. Raw error text is never shown to the user.

// Longer names first where one contains another.
const KNOWN = [
  "not_platform_admin",
  "already_member",
  "platform_admin",
  "invitation_not_found",
  "invitation_used",
  "invitation_revoked",
  "invitation_expired",
  "invitation_wrong_email",
  "masjid_not_found",
  "name_required",
  "last_pengerusi",
] as const;

export type ErrorKey = (typeof KNOWN)[number] | "generic";

export function errorKey(message: string | undefined | null): ErrorKey {
  if (!message) return "generic";
  if (message.includes("the last Pengerusi cannot be removed")) return "last_pengerusi";
  return KNOWN.find((key) => message.includes(key)) ?? "generic";
}
