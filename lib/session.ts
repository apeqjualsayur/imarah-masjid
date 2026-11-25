import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LOGO_BUCKET, LOGO_LINK_SECONDS } from "@/lib/logo";
import { can, isRole, type Capability, type Role } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type MasjidSummary = {
  id: string;
  name: string;
  state: string | null;
  address: string | null;
  plan: string;
  logo_path: string | null;
  prayer_zone: string | null;
};

/** The short place line under the masjid name: the address's first line, else the state. */
export function areaLine(masjid: MasjidSummary) {
  const firstLine = masjid.address?.split(/\r?\n|,/)[0]?.trim();
  return firstLine || masjid.state || "";
}

export type MemberContext = {
  user: User;
  role: Role;
  masjid: MasjidSummary;
};

export function isPlatformAdmin(user: User) {
  return user.app_metadata?.platform_admin === true;
}

export function displayName(user: User) {
  const name = user.user_metadata?.full_name;
  return typeof name === "string" && name.trim() ? name.trim() : (user.email ?? "");
}

/** The signed-in user, checked with Supabase on every request. */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/**
 * The user's active membership and masjid. Read through RLS, so it can only
 * ever return the user's own masjid. The masjid id never comes from the URL.
 */
export const getMembership = cache(async (): Promise<Omit<MemberContext, "user"> | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select("masjid_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership || !isRole(membership.role)) return null;

  const { data: masjid } = await supabase
    .from("masjids")
    .select("id, name, state, address, plan, logo_path, prayer_zone")
    .eq("id", membership.masjid_id)
    .single();
  if (!masjid) return null;

  return { role: membership.role, masjid };
});

/**
 * A one-hour signed link to the member's own masjid logo, made as the user so
 * Storage rules apply. Null when there is no logo or it cannot be read.
 */
export const getLogoUrl = cache(async (logoPath: string | null): Promise<string | null> => {
  if (!logoPath) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(logoPath, LOGO_LINK_SECONDS);
  return data?.signedUrl ?? null;
});

/**
 * Guards the platform admin pages: a flagged account that passed 2-step
 * verification in this session. The database checks the same again.
 */
export async function requirePlatformAdmin(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/pentadbir/log-masuk");
  if (!isPlatformAdmin(user)) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel !== "aal2") redirect("/pentadbir/pengesahan");

  return user;
}

/**
 * Guards every page inside the app. Sends people who are not signed in, have
 * no masjid yet, or lack the capability somewhere they belong.
 */
export async function requireMember(capability?: Capability): Promise<MemberContext> {
  const user = await getUser();
  if (!user) redirect("/log-masuk");
  if (isPlatformAdmin(user)) redirect("/pentadbir");

  const membership = await getMembership();
  if (!membership) redirect("/mula");
  if (capability && !can(membership.role, capability)) redirect("/tiada-akses");

  return { user, ...membership };
}
