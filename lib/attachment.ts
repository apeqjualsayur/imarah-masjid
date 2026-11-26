// Checks for receipt and bill attachments. Decided from the file's own bytes,
// never its name or what the browser claims.

export const ATTACHMENT_BUCKET = "transaction-files";
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
/** Links to an attachment last five minutes. */
export const ATTACHMENT_LINK_SECONDS = 5 * 60;

type Kind = { ext: "jpg" | "png" | "webp" | "pdf"; contentType: string };

export type AttachmentCheck =
  | ({ ok: true } & Kind)
  | { ok: false; error: "attachment_too_big" | "attachment_wrong_type" };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, i) => bytes[offset + i] === value);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

function kindOf(bytes: Uint8Array): Kind | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { ext: "jpg", contentType: "image/jpeg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: "png", contentType: "image/png" };
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return { ext: "webp", contentType: "image/webp" };
  if (startsWith(bytes, ascii("%PDF-"))) return { ext: "pdf", contentType: "application/pdf" };
  return null;
}

/** A JPG, PNG, WebP or PDF up to 5 MB. An empty file is treated as "no attachment" by the caller. */
export function checkAttachment(bytes: Uint8Array): AttachmentCheck {
  if (bytes.length > ATTACHMENT_MAX_BYTES) return { ok: false, error: "attachment_too_big" };
  const kind = kindOf(bytes);
  return kind ? { ok: true, ...kind } : { ok: false, error: "attachment_wrong_type" };
}
