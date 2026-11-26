"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CloudOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/kewangan/bits";
import { Button } from "@/components/ui/forms";
import { submitCount } from "@/app/(app)/kewangan/kutipan/actions";
import { isNetworkFailure } from "@/lib/collections";
import { formatDay } from "@/lib/dates";
import { formatSen } from "@/lib/money";
import { forget, useQueue } from "./queue";

/**
 * Counts kept on this phone, marked "Belum dihantar". They are sent when the
 * page opens, when the signal comes back, or when "Hantar sekarang" is pressed.
 * A count the server refuses (for example a locked month) stays with its
 * reason until it is removed.
 */
export function PendingQueue({ userId }: { userId: string }) {
  const t = useTranslations("kutipan");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const queue = useQueue(userId);
  const [refused, setRefused] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const busy = useRef(false);

  const sendAll = useCallback(async () => {
    if (busy.current || navigator.onLine === false) return;
    busy.current = true;
    setSending(true);
    let sent = 0;
    try {
      for (const item of queue) {
        try {
          const result = await submitCount(item);
          if (result.ok) {
            forget(userId, item.key);
            sent += 1;
          } else {
            setRefused((current) => ({ ...current, [item.key]: result.error }));
          }
        } catch (failure) {
          if (isNetworkFailure(failure)) break;
          setRefused((current) => ({ ...current, [item.key]: "generic" }));
        }
      }
    } finally {
      busy.current = false;
      setSending(false);
      if (sent > 0) router.refresh();
    }
  }, [queue, userId, router]);

  useEffect(() => {
    window.addEventListener("online", sendAll);
    return () => window.removeEventListener("online", sendAll);
  }, [sendAll]);

  const firstLoad = useRef(true);
  useEffect(() => {
    if (!firstLoad.current || queue.length === 0) return;
    firstLoad.current = false;
    const timer = window.setTimeout(sendAll, 0);
    return () => window.clearTimeout(timer);
  }, [queue.length, sendAll]);

  if (queue.length === 0) return null;

  return (
    <section aria-labelledby="belum-dihantar" className="mt-5 rounded-card border border-gold bg-gold-tint/40 p-4" data-testid="belum-dihantar">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="belum-dihantar" className="flex items-center gap-2 font-bold">
          <CloudOff aria-hidden className="size-5" />
          {t("queueTitle", { count: queue.length })}
        </h2>
        <Button type="button" variant="secondary" onClick={sendAll} disabled={sending} aria-busy={sending}>
          {sending ? t("sending") : t("sendNow")}
        </Button>
      </div>
      <p className="mt-1 text-sm">{t("queueLead")}</p>
      <ul className="mt-3 divide-y divide-rule rounded-chip bg-surface">
        {queue.map((item) => (
          <li key={item.key} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <Badge tone="warn">{t("notSent")}</Badge>
            <span className="min-w-0 flex-1 text-sm">
              {formatDay(item.date, locale)} · {item.fund_name}
              {refused[item.key] ? <span className="block text-warn-ink">{errors(refused[item.key])}</span> : null}
            </span>
            <span className="font-semibold tabular-nums">{formatSen(item.total_sen)}</span>
            {refused[item.key] ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t("confirmDiscard"))) forget(userId, item.key);
                }}
                className="inline-flex min-h-tap items-center gap-1 text-sm font-semibold text-warn-ink underline underline-offset-4"
              >
                <Trash2 aria-hidden className="size-4" />
                {t("discard")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
