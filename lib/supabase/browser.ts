"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Acts as the signed-in user from the browser, so Storage and row rules apply.
 * Used only to upload attachments straight to Storage: large files would be
 * too big to pass through a server function.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
