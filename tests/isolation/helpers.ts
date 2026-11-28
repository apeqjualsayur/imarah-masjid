import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDevEnv } from "../../scripts/db-env";
import { seedEmail, type MasjidKey, type Role } from "../../scripts/seed-data";

const env = loadDevEnv();
const options = { auth: { persistSession: false, autoRefreshToken: false } };

export const PERMISSION_DENIED = "42501";

export const admin = createClient(env.url, env.serviceKey, options);
export const anon = createClient(env.url, env.anonKey, options);

const signedIn = new Map<string, Promise<SupabaseClient>>();

async function signIn(email: string) {
  const client = createClient(env.url, env.anonKey, options);
  const { error } = await client.auth.signInWithPassword({ email, password: env.password });
  if (error) throw new Error(`${email}: ${error.message}`);
  return client;
}

export function userClient(masjid: MasjidKey, role: Role) {
  const email = seedEmail(masjid, role);
  if (!signedIn.has(email)) signedIn.set(email, signIn(email));
  return signedIn.get(email)!;
}

/**
 * A brand-new confirmed account with no masjid, signed in. Each test run makes
 * fresh ones, because accounts with memberships can never be deleted.
 */
export async function newUser(appMetadata: Record<string, unknown> = {}) {
  const email = `uji-${crypto.randomUUID()}@imarah.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: env.password,
    email_confirm: true,
    app_metadata: appMetadata,
  });
  if (error) throw new Error(error.message);
  return { id: data.user.id, email, client: await signIn(email) };
}

export async function userId(masjid: MasjidKey, role: Role) {
  const client = await userClient(masjid, role);
  const { data } = await client.auth.getUser();
  return data.user!.id;
}

/** Every table in the database. The coverage test fails if this falls out of date. */
export const TABLES = [
  "audit_log",
  "bank_formats",
  "bank_imports",
  "bank_lines",
  "categories",
  "collections",
  "funds",
  "households",
  "invitations",
  "khairat_members",
  "khairat_plans",
  "masjids",
  "members",
  "memberships",
  "periods",
  "receipt_counters",
  "reports",
  "transactions",
];

export async function firstAuditRowId(masjidId: string) {
  const { data, error } = await admin.from("audit_log").select("id").eq("masjid_id", masjidId).limit(1).single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
