import "server-only";

type Attachment = { filename: string; content: Buffer };
type Email = { to: string; subject: string; text: string; attachments?: Attachment[] };

/** True when Resend is set up, so screens can offer email at all. */
export const emailEnabled = () => !!process.env.RESEND_API_KEY;

/**
 * Sends through Resend's API. Returns false when Resend is not set up or the
 * send fails, so callers can fall back to the copy-link button. The address
 * and message are never logged.
 */
export async function sendEmail({ to, subject, text, attachments }: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  const from = process.env.RESEND_FROM || "Imarah <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        attachments: attachments?.map((file) => ({ filename: file.filename, content: file.content.toString("base64") })),
      }),
    });
    if (!response.ok) console.error(`Resend refused the email: HTTP ${response.status}`);
    return response.ok;
  } catch {
    console.error("Resend could not be reached");
    return false;
  }
}
