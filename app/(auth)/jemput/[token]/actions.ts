"use server";

import { redirect } from "next/navigation";
import { errorKey } from "@/lib/auth-errors";
import { getUser, isPlatformAdmin } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "../../actions";

export type InvitePreview = { masjid_name: string; role: string; email: string; status: string };

export async function previewInvitation(token: string): Promise<InvitePreview | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("invitation_preview", { p_token: token });
  return (data as InvitePreview[] | null)?.[0] ?? null;
}

/** A signed-in person whose email matches joins the masjid. */
export async function acceptSignedIn(token: string): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect(`/jemput/${token}`);
  if (isPlatformAdmin(user)) return { error: "platform_admin" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { error: errorKey(error.message) };

  redirect("/");
}

/**
 * Someone without an account sets a name and password. The link went to the
 * invited email and only works for that email, so the account is created
 * already confirmed, then joins the masjid.
 */
export async function acceptAsNewUser(token: string, _: FormState, form: FormData): Promise<FormState> {
  const fullName = typeof form.get("fullName") === "string" ? (form.get("fullName") as string).trim() : "";
  const password = form.get("password");
  if (!fullName || typeof password !== "string") return { error: "missing_fields" };
  if (password.length < 8) return { error: "weak_password" };

  const preview = await previewInvitation(token);
  if (!preview) return { error: "invitation_not_found" };
  if (preview.status !== "pending") return { error: `invitation_${preview.status}` };

  const { error: createError } = await createAdminClient().auth.admin.createUser({
    email: preview.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError) {
    return { error: createError.code === "email_exists" ? "account_exists" : "generic" };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: preview.email, password });
  if (signInError) return { error: "generic" };

  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { error: errorKey(error.message) };

  redirect("/");
}
