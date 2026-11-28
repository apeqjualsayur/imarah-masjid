import { notFound } from "next/navigation";
import { buildReceiptPdf, receiptFileName } from "@/lib/receipts";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/** The receipt PDF for signed-in members who may view receipts. ?muat=1 downloads it. */
export async function GET(request: Request, { params }: RouteContext<"/kewangan/resit/[id]/pdf">) {
  await requireMember("receipts.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const built = await buildReceiptPdf(await createClient(), id);
  if (!built) notFound();

  const download = new URL(request.url).searchParams.get("muat") === "1";
  return new Response(new Uint8Array(built.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${receiptFileName(built.receipt.receipt_no)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
