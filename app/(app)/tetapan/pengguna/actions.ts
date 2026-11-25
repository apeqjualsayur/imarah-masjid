"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { errorKey } from "@/lib/auth-errors";
import { sendEmail } from "@/lib/email";
import { hashInviteToken, looksLikeEmail, newInviteToken, normaliseEmail } from "@/lib/invitations";
import { appOrigin } from "@/lib/origin";
import { isRole } from "@/lib/permissions";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const PAGE = "/tetapan/pengguna";

export type InviteState = { error?: string; link?: string; emailed?: boolean; email?: string };
export type RowState = { error?: string };

/**
 * Creates an invitation and returns its link. The masjid comes from the
 * session, never from the form. RLS checks again that only a Pengerusi can.
 */
export async function inviteUser(_: InviteState, form: FormData): Promise<InviteState> {
  const { masjid } = await requireMember("users.manage");
  const email = normaliseEmail(String(form.get("email") ?? ""));
  const role = form.get("role");
  if (!looksLikeEmail(email) || !isRole(role)) return { error: "missing_fields" };

  const supabase = await createClient();

  const { data: users } = await supabase.rpc("masjid_users");
  const existing = (users as { email: string; status: string }[] | null)?.find((user) => user.email === email);
  if (existing?.status === "active") return { error: "already_in_masjid" };

  // One open invitation per email: the newest replaces any earlier link.
  await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null);

  const token = newInviteToken();
  const { error } = await supabase.from("invitations").insert({ email, role, token_hash: hashInviteToken(token) });
  if (error) return { error: errorKey(error.message) };

  const link = `${await appOrigin()}/jemput/${token}`;

  // The email is in both languages: we do not know which the invitee reads.
  const [ms, en] = await Promise.all([
    getTranslations({ locale: "ms", namespace: "email" }),
    getTranslations({ locale: "en", namespace: "email" }),
  ]);
  const [msRoles, enRoles] = await Promise.all([
    getTranslations({ locale: "ms", namespace: "roles" }),
    getTranslations({ locale: "en", namespace: "roles" }),
  ]);
  const emailed = await sendEmail({
    to: email,
    subject: ms("inviteSubject", { masjid: masjid.name }),
    text: [
      ms("inviteBody", { masjid: masjid.name, role: msRoles(role), link }),
      "",
      "---",
      "",
      en("inviteBody", { masjid: masjid.name, role: enRoles(role), link }),
    ].join("\n"),
  });

  revalidatePath(PAGE);
  return { link, emailed, email };
}

export async function revokeInvitation(id: string): Promise<RowState> {
  await requireMember("users.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: "generic" };
  revalidatePath(PAGE);
  return {};
}

export async function changeRole(userId: string, _: RowState, form: FormData): Promise<RowState> {
  const { user } = await requireMember("users.manage");
  const role = form.get("role");
  if (!isRole(role) || userId === user.id) return { error: "generic" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("memberships").update({ role }).eq("user_id", userId).select("id");
  if (error) return { error: errorKey(error.message) };
  if (!data?.length) return { error: "generic" };
  revalidatePath(PAGE);
  return {};
}

export async function setActive(userId: string, active: boolean): Promise<RowState> {
  const { user } = await requireMember("users.manage");
  if (userId === user.id) return { error: "generic" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .update({ status: active ? "active" : "removed" })
    .eq("user_id", userId)
    .select("id");
  if (error) return { error: errorKey(error.message) };
  if (!data?.length) return { error: "generic" };
  revalidatePath(PAGE);
  return {};
}
