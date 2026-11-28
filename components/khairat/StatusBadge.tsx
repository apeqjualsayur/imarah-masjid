import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/kewangan/bits";
import type { KhairatStatus } from "@/lib/khairat";

const TONE: Record<KhairatStatus, "teal" | "warn" | "plain"> = { aktif: "teal", tunggakan: "warn", tamat: "plain" };

/** Aktif, Tunggakan or Tamat, in words as well as colour. */
export async function StatusBadge({ status }: { status: KhairatStatus }) {
  const t = await getTranslations("khairat");
  return <Badge tone={TONE[status]}>{t(`statuses.${status}`)}</Badge>;
}
