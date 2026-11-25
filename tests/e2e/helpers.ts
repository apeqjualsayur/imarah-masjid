import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadDevEnv } from "../../scripts/db-env";

export const env = loadDevEnv();
export const admin = createClient(env.url, env.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** A confirmed account with no masjid. Fresh per run: members cannot be deleted. */
export async function newAccount(fullName: string) {
  const email = `e2e-${crypto.randomUUID()}@example.test`;
  const { error } = await admin.auth.admin.createUser({
    email,
    password: env.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(error.message);
  return email;
}

export async function signIn(page: Page, email: string, password = env.password) {
  await page.goto("/log-masuk");
  await page.getByLabel("Emel").first().fill(email);
  await page.getByLabel("Kata laluan").fill(password);
  await page.getByRole("button", { name: "Log masuk", exact: true }).click();
  await expect(page).not.toHaveURL(/\/log-masuk/);
}

export function mainNav(page: Page) {
  return page.getByRole("navigation", { name: "Navigasi utama" });
}
