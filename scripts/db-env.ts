// masjidview.my's live database. Imarah must never share a database with it.
const FORBIDDEN_PROJECT_PREFIX = "fiensjdq";

/**
 * Loads .env.local for the seed script and isolation tests. They write fake
 * data, so they refuse to run against anything not marked as the dev database.
 */
export function loadDevEnv() {
  process.loadEnvFile(".env.local");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.SEED_USER_PASSWORD;

  if (!url || !anonKey || !serviceKey || !password) {
    throw new Error("Missing Supabase values or SEED_USER_PASSWORD in .env.local");
  }
  if (process.env.IMARAH_DB_ENV !== "dev") {
    throw new Error("Refusing to run: IMARAH_DB_ENV is not dev");
  }
  if (url.includes(FORBIDDEN_PROJECT_PREFIX)) {
    throw new Error("Refusing to run: this is the masjidview.my database");
  }

  return { url, anonKey, serviceKey, password };
}
