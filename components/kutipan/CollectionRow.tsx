import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/kewangan/bits";
import { amountVisible, type Collection } from "@/app/(app)/kewangan/kutipan/data";
import { formatDay } from "@/lib/dates";
import { formatSen } from "@/lib/money";

const TONES = { counted: "gold", needs_review: "warn", confirmed: "teal", void: "plain" } as const;

/** One count in a list: date, fund, who counted, its status and (when allowed) its amount. */
export async function CollectionRow({
  collection,
  userId,
  fundName,
  names,
}: {
  collection: Collection;
  userId: string;
  fundName: string;
  names: Map<string, string>;
}) {
  const t = await getTranslations("kutipan");
  const locale = await getLocale();
  const mine = collection.counted_by === userId;

  return (
    <li>
      <Link
        href={`/kewangan/kutipan/${collection.id}`}
        className="flex min-h-tap items-center gap-3 px-4 py-3 hover:bg-background"
        data-testid="baris-kutipan"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">
            {formatDay(collection.date, locale)} · {fundName}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2">
            <Badge tone={TONES[collection.status]}>{t(`status.${collection.status}`)}</Badge>
            <span className="text-sm text-muted">
              {mine ? t("countedByYou") : t("countedBy", { name: names.get(collection.counted_by) ?? "—" })}
            </span>
          </span>
        </span>
        <span className="shrink-0 font-semibold tabular-nums">
          {amountVisible(collection, userId) ? formatSen(collection.total_sen) : <span className="text-sm font-normal text-muted">{t("hidden")}</span>}
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
      </Link>
    </li>
  );
}
