"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CircleAlert, CircleCheck, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { Notice, SubmitButton } from "@/components/ui/forms";
import { formatPhone } from "@/lib/phone";
import { confirmImport, previewImport, type PreviewState } from "../actions";

/** Upload -> preview with row errors -> confirm -> summary. Nothing is saved before confirm. */
export function ImportFlow() {
  const t = useTranslations("kariahImport");
  const errors = useTranslations("errors");
  const [preview, previewAction] = useActionState(previewImport, { stage: "upload" } as PreviewState);
  const [result, confirmAction] = useActionState(confirmImport, { stage: "upload" } as PreviewState);

  if (result.stage === "done") {
    return (
      <div className="mt-6 max-w-2xl space-y-4 rounded-card bg-surface p-5">
        <Notice tone={result.error ? "error" : "success"}>
          {t("summary", { imported: result.imported, skipped: result.skipped })}
          {result.error ? ` ${errors(result.error)}` : ""}
        </Notice>
        <div className="flex flex-wrap gap-2">
          <Link href="/kariah" className="inline-flex min-h-tap items-center rounded-chip bg-primary px-5 font-semibold text-surface">
            {t("toList")}
          </Link>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload starts a clean import */}
          <a href="/kariah/import" className="inline-flex min-h-tap items-center rounded-chip border border-border bg-surface px-5 font-semibold text-primary-dark">
            {t("again")}
          </a>
        </div>
      </div>
    );
  }

  const uploadError = result.stage === "upload" && result.error ? result.error : preview.stage === "upload" ? preview.error : undefined;

  return (
    <>
      <section className="mt-6 max-w-2xl rounded-card bg-surface p-5">
        <h2 className="text-lg font-bold">{t("step1")}</h2>
        <p className="mt-1 text-sm text-muted">{t("templateHelp")}</p>
        <a
          href="/kariah/import/templat"
          download
          className="mt-3 inline-flex min-h-tap items-center gap-2 rounded-chip border border-border bg-surface px-4 font-semibold text-primary-dark"
        >
          <Download aria-hidden className="size-4" />
          {t("template")}
        </a>

        <h2 className="mt-6 text-lg font-bold">{t("step2")}</h2>
        <form action={previewAction} className="mt-3 space-y-3">
          {uploadError ? <Notice tone="error">{errors(uploadError, { limit: 150 })}</Notice> : null}
          <label className="block">
            <span className="sr-only">{t("file")}</span>
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              className="block min-h-tap w-full rounded-chip border border-border bg-surface px-3 py-2.5 text-sm file:mr-3 file:min-h-9 file:rounded-chip file:border-0 file:bg-tint file:px-4 file:font-semibold file:text-primary-dark"
            />
          </label>
          <SubmitButton pendingLabel={t("checking")}>{t("check")}</SubmitButton>
        </form>
      </section>

      {preview.stage === "preview" ? (
        <section aria-labelledby="pratonton" className="mt-6">
          <h2 id="pratonton" className="text-lg font-bold">
            {t("step3")}
          </h2>
          <p className="mt-1" data-testid="import-counts">
            {t("counts", { valid: preview.valid, invalid: preview.invalid })}
          </p>
          {preview.room !== null && preview.valid > preview.room ? (
            <div className="mt-3">
              <Notice tone="error">{t("overLimit", { room: preview.room })}</Notice>
            </div>
          ) : null}

          <div className="mt-3 overflow-x-auto rounded-card bg-surface">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-muted">
                <tr className="border-b border-rule">
                  <th scope="col" className="px-3 py-2 font-medium">{t("colLine")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("colName")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("colPhone")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("colConsent")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("colResult")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {preview.rows.map((row) => {
                  const ok = row.errors.length === 0;
                  return (
                    <tr key={row.line} className={ok ? "" : "bg-warn-bg/40"}>
                      <td className="px-3 py-2 text-muted">{row.line}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{row.head_name || "—"}</span>
                        {row.address ? <span className="block text-xs text-muted">{row.address}</span> : null}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.phone ? formatPhone(row.phone) : "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        WA {row.whatsapp ? "✓" : "✗"} · PDPA {row.pdpa ? "✓" : "✗"}
                      </td>
                      <td className="px-3 py-2">
                        {ok ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-primary-dark">
                            <CircleCheck aria-hidden className="size-4" />
                            {t("willImport")}
                          </span>
                        ) : (
                          <ul className="space-y-0.5 text-warn-ink">
                            {row.errors.map((error) => (
                              <li key={error} className="flex items-start gap-1">
                                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                                {t(`rowError.${error}`)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <form action={confirmAction} className="mt-4 space-y-2">
            <input type="hidden" name="text" value={preview.text} />
            <p className="text-sm text-muted">{t("confirmHelp")}</p>
            <SubmitButton
              pendingLabel={t("importing")}
              disabled={preview.valid === 0 || (preview.room !== null && preview.valid > preview.room)}
            >
              {t("confirm", { count: preview.valid })}
            </SubmitButton>
          </form>
        </section>
      ) : null}
    </>
  );
}
