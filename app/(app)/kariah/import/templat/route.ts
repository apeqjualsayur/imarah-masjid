import { templateCsv } from "@/lib/kariah-import";
import { requireMember } from "@/lib/session";

/** The CSV template, with BM headers and two example rows. */
export async function GET() {
  await requireMember("kariah.edit");
  return new Response(templateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="templat-kariah.csv"',
      "Cache-Control": "no-store",
    },
  });
}
