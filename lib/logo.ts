// Checks for uploaded masjid logos. Pure functions, so they are easy to test.

export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_BUCKET = "masjid-logos";
/** Signed links to a logo last one hour. */
export const LOGO_LINK_SECONDS = 60 * 60;

export type LogoCheck =
  | { ok: true; ext: "png" | "svg"; contentType: "image/png" | "image/svg+xml" }
  | { ok: false; error: "logo_empty" | "logo_too_big" | "logo_wrong_type" | "logo_unsafe_svg" };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Anything that could run code or fetch from elsewhere when the SVG is opened.
const UNSAFE_SVG = [
  /<script/i,
  /\bon[a-z]+\s*=/i,
  /javascript:/i,
  /<foreignObject/i,
  /<(iframe|embed|object|audio|video)\b/i,
  /<!ENTITY/i,
  /(href|src)\s*=\s*["']?\s*(https?:|\/\/|data:text)/i,
  /@import/i,
];

/**
 * Decides from the file's own bytes, not its name or the browser's claim,
 * whether it is a PNG or a safe SVG under 1 MB.
 */
export function checkLogo(bytes: Uint8Array): LogoCheck {
  if (bytes.length === 0) return { ok: false, error: "logo_empty" };
  if (bytes.length > LOGO_MAX_BYTES) return { ok: false, error: "logo_too_big" };

  if (PNG_SIGNATURE.every((value, i) => bytes[i] === value)) {
    return { ok: true, ext: "png", contentType: "image/png" };
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const start = text.replace(/^﻿/, "").trimStart();
  const looksLikeSvg =
    /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(start) &&
    /<\/svg>\s*$/i.test(text.trimEnd());
  if (!looksLikeSvg) return { ok: false, error: "logo_wrong_type" };
  if (UNSAFE_SVG.some((pattern) => pattern.test(text))) return { ok: false, error: "logo_unsafe_svg" };

  return { ok: true, ext: "svg", contentType: "image/svg+xml" };
}

/** "Surau Baru" -> "SB". Used when a masjid has no logo yet. */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => [...word][0] ?? "");
  return letters.join("").toUpperCase() || "?";
}
