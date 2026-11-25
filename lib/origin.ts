import "server-only";
import { headers } from "next/headers";

/**
 * The address the user is on, so email links work on localhost, Vercel
 * previews and production alike.
 */
export async function appOrigin() {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (host) {
    const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3009";
}
