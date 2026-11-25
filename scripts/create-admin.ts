// Makes a platform admin account, or turns an existing account into one.
// Run: npm run admin:create -- someone@example.com
// A new account gets a random password, printed once. Change it after the
// first sign-in. The account must not belong to any masjid.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadServerEnv } from "./db-env";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:create -- someone@example.com");
  process.exit(1);
}

const { url, serviceKey } = loadServerEnv();
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function findUser(address: string) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const found = data.users.find((user) => user.email?.toLowerCase() === address);
    if (found || data.users.length < 1000) return found ?? null;
  }
}

async function main() {
  const existing = await findUser(email);

  if (existing) {
    const { count } = await admin
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("user_id", existing.id);
    if (count) throw new Error("This account belongs to a masjid. Use a separate email for the platform admin.");

    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      app_metadata: { ...existing.app_metadata, platform_admin: true },
    });
    if (error) throw new Error(error.message);
    console.log(`${email} is now a platform admin. Sign in at /pentadbir/log-masuk with its current password.`);
    return;
  }

  const password = randomBytes(18).toString("base64url");
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { platform_admin: true },
    user_metadata: { full_name: "Pentadbir Imarah" },
  });
  if (error) throw new Error(error.message);

  console.log(`Platform admin created: ${email}`);
  console.log(`Temporary password (shown once): ${password}`);
  console.log("Sign in at /pentadbir/log-masuk and set up the authenticator app.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
