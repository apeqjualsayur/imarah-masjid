// Fills the dev database with fake data. Safe to run twice: rows that already
// exist are skipped, because transactions cannot be updated. Run: npm run db:seed
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDevEnv } from "./db-env";
import {
  masjidId,
  seedEmail,
  seedMasjid,
  seedRoles,
  seedRows,
  type MasjidKey,
  type Role,
  type Row,
} from "./seed-data";

const { url, serviceKey, password } = loadDevEnv();
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function insertMissing(client: SupabaseClient, table: string, rows: Row[]) {
  const ids = rows.map((row) => row.id as string);
  const { data, error } = await client.from(table).select("id").in("id", ids);
  if (error) throw new Error(`${table}: ${error.message}`);

  const existing = new Set(data.map((row) => row.id));
  const missing = rows.filter((row) => !existing.has(row.id));
  if (missing.length > 0) {
    const { error: insertError } = await client.from(table).insert(missing);
    if (insertError) throw new Error(`${table}: ${insertError.message}`);
  }
  console.log(`${table}: ${missing.length} added, ${existing.size} already there`);
}

async function ensureUsers(masjid: MasjidKey, known: Map<string, string>) {
  const users: Partial<Record<Role, string>> = {};

  for (const role of seedRoles[masjid]) {
    const email = seedEmail(masjid, role);
    let id = known.get(email);

    if (!id) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw new Error(`${email}: ${error.message}`);
      id = data.user.id;
    }
    users[role] = id;
  }

  return users;
}

async function main() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);
  const known = new Map(data.users.map((user) => [user.email ?? "", user.id]));

  for (const masjid of ["a", "b"] as const) {
    console.log(`\n${masjidId(masjid)}`);
    await insertMissing(admin, "masjids", [seedMasjid(masjid)]);

    const users = await ensureUsers(masjid, known);
    for (const [table, rows] of seedRows(masjid, users)) {
      await insertMissing(admin, table, rows);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
