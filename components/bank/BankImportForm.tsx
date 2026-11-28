"use client";

import { startTransition, useActionState, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { importBankStatement, previewBankImport, type ImportState } from "@/app/(app)/kewangan/bank/actions";
import type { SavedFormat } from "@/app/(app)/kewangan/bank/data";
import { Badge, SignedAmount } from "@/components/kewangan/bits";
import { Button, Field, Notice, SelectInput, TextInput } from "@/components/ui/forms";
import { BANK_FILE_MAX_BYTES, DATE_ORDERS, findHeaderRow, guessHeaderRow } from "@/lib/bank-import";
import { decodeCsv, parseCsv, type CsvRow } from "@/lib/csv";
import { formatDay } from "@/lib/dates";
import { formatSen } from "@/lib/money";

type Mapping = {
  name: string;
  date_column: string;
  description_1: string;
  description_2: string;
  kind: "split" | "single";
  debit_column: string;
  credit_column: string;
  amount_column: string;
  date_order: string;
};

const EMPTY: Mapping = {
  name: "",
  date_column: "",
  description_1: "",
  description_2: "",
  kind: "split",
  debit_column: "",
  credit_column: "",
  amount_column: "",
  date_order: "dmy",
};

/** First header that looks like the column, by its name in Malay or English. */
function guessMapping(headers: string[]): Mapping {
  const find = (pattern: RegExp, not: string[] = []) => headers.find((h) => pattern.test(h) && !not.includes(h)) ?? "";
  const date = find(/tarikh|date/i);
  const description = find(/keterangan|butiran|description|details|transaksi|transaction|particular|catatan/i, [date]);
  const debit = find(/debit|keluar|withdraw|pengeluaran/i, [date, description]);
  const credit = find(/kredit|credit|masuk|deposit/i, [date, description, debit]);
  const amount = find(/amaun|amount|jumlah/i, [date, description]);
  const reference = find(/rujukan|reference|ref/i, [date, description, debit, credit]);
  const single = !(debit && credit) && !!amount;
  return {
    ...EMPTY,
    date_column: date,
    description_1: description,
    description_2: reference,
    kind: single ? "single" : "split",
    debit_column: debit,
    credit_column: credit,
    amount_column: single ? amount : "",
  };
}

export function BankImportForm({ formats }: { formats: SavedFormat[] }) {
  const t = useTranslations("bankImport");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const [file, setFile] = useState<{ name: string; csv: string; rows: CsvRow[] } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formatId, setFormatId] = useState(formats[0]?.id ?? "baru");
  const [mapping, setMapping] = useState<Mapping>(EMPTY);
  const [preview, previewAction, previewing] = useActionState(previewBankImport, {} as ImportState);
  const [saved, importAction, importing] = useActionState(importBankStatement, {} as ImportState);
  const formRef = useRef<HTMLFormElement>(null);

  // Sent by hand, not as a form action: a form action clears the fields
  // afterwards, and the import needs the same choices the preview used.
  const send = (action: (form: FormData) => void) => {
    if (!formRef.current?.reportValidity()) return;
    const form = new FormData(formRef.current);
    startTransition(() => action(form));
  };

  const headerAt = file ? guessHeaderRow(file.rows) : 0;
  const headers = useMemo(
    () => (file ? [...new Set(file.rows[headerAt]?.cells.filter((cell) => cell.trim()) ?? [])] : []),
    [file, headerAt],
  );
  const sample = file ? file.rows.slice(headerAt + 1, headerAt + 4) : [];

  // What the preview was made from; a change to any of it hides the old preview.
  const stamp = JSON.stringify([file?.name, file?.csv.length, formatId, formatId === "baru" ? mapping : null]);
  const shown = preview.stamp === stamp ? preview : {};

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    setFileError(null);
    setFile(null);
    if (!chosen) return;
    if (chosen.size > BANK_FILE_MAX_BYTES) {
      setFileError(errors("bank_file_too_big"));
      return;
    }
    const csv = decodeCsv(new Uint8Array(await chosen.arrayBuffer()));
    const rows = parseCsv(csv);
    if (rows.length < 2) {
      setFileError(errors("bank_no_lines"));
      return;
    }
    setFile({ name: chosen.name, csv, rows });
    // A saved bank whose columns are all in this file is chosen for you.
    const known = formats.find((format) => findHeaderRow(rows, format) >= 0);
    if (known) setFormatId(known.id);
    else {
      setFormatId("baru");
      const guessed = guessHeaderRow(rows);
      setMapping({ ...guessMapping([...new Set(rows[guessed]?.cells.filter((cell) => cell.trim()) ?? [])]), name: "" });
    }
  }

  const set = (field: keyof Mapping) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setMapping((current) => ({ ...current, [field]: event.target.value }));

  const columnSelect = (field: keyof Mapping, label: string, optional = false) => (
    <Field label={label}>
      <SelectInput name={field} value={mapping[field]} onChange={set(field)} required={!optional}>
        <option value="">{optional ? t("none") : t("chooseColumn")}</option>
        {headers.map((header) => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </SelectInput>
    </Field>
  );

  const error = saved.error ?? shown.error;

  return (
    <form ref={formRef} onSubmit={(event) => event.preventDefault()} className="mt-5 max-w-3xl space-y-5">
      <input type="hidden" name="csv" value={file?.csv ?? ""} />
      <input type="hidden" name="file_name" value={file?.name ?? ""} />
      <input type="hidden" name="stamp" value={stamp} />

      <section className="rounded-card bg-surface p-5">
        <h2 className="text-lg font-bold">{t("step1")}</h2>
        <p className="mt-1 text-sm text-muted">{t("step1Lead")}</p>
        <div className="mt-3">
          <Field label={t("file")} hint={t("fileHint")}>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              className="mt-1.5 block min-h-tap w-full text-sm file:mr-3 file:min-h-tap file:rounded-chip file:border-0 file:bg-tint file:px-4 file:font-semibold file:text-primary-dark"
            />
          </Field>
        </div>
        {fileError ? (
          <div className="mt-3">
            <Notice tone="error">{fileError}</Notice>
          </div>
        ) : null}
      </section>

      {file ? (
        <section className="rounded-card bg-surface p-5">
          <h2 className="text-lg font-bold">{t("step2")}</h2>
          <div className="mt-3">
            <Field label={t("bank")}>
              <SelectInput name="format_id" value={formatId} onChange={(event) => setFormatId(event.target.value)}>
                {formats.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.name}
                  </option>
                ))}
                <option value="baru">{t("newBank")}</option>
              </SelectInput>
            </Field>
          </div>

          {formatId === "baru" ? (
            <div className="mt-4 space-y-4" data-testid="pilih-lajur">
              <p className="text-sm text-muted">{t("mapLead")}</p>
              {sample.length > 0 ? (
                <div className="overflow-x-auto rounded-chip border border-border">
                  <table className="min-w-full text-left text-xs">
                    <caption className="sr-only">{t("sampleCaption")}</caption>
                    <thead className="bg-background">
                      <tr>
                        {file.rows[headerAt].cells.map((cell, i) => (
                          <th key={i} scope="col" className="px-2 py-1.5 font-semibold whitespace-nowrap">
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sample.map((row) => (
                        <tr key={row.line} className="border-t border-rule">
                          {row.cells.map((cell, i) => (
                            <td key={i} className="px-2 py-1.5 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <Field label={t("bankName")} hint={t("bankNameHint")}>
                <TextInput name="name" value={mapping.name} onChange={set("name")} required maxLength={60} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                {columnSelect("date_column", t("dateColumn"))}
                <Field label={t("dateOrder")}>
                  <SelectInput name="date_order" value={mapping.date_order} onChange={set("date_order")}>
                    {DATE_ORDERS.map((order) => (
                      <option key={order} value={order}>
                        {t(`orders.${order}`)}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                {columnSelect("description_1", t("descriptionColumn"))}
                {columnSelect("description_2", t("descriptionColumn2"), true)}
              </div>

              <fieldset>
                <legend className="font-semibold">{t("amountKind")}</legend>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  {(["split", "single"] as const).map((kind) => (
                    <label
                      key={kind}
                      className={`flex min-h-tap cursor-pointer items-center gap-3 rounded-chip border p-3 ${mapping.kind === kind ? "border-primary bg-tint" : "border-border bg-surface"}`}
                    >
                      <input type="radio" name="kind" value={kind} checked={mapping.kind === kind} onChange={set("kind")} className="size-5 accent-primary" />
                      <span>
                        <span className="block font-semibold">{t(`kinds.${kind}`)}</span>
                        <span className="block text-sm text-muted">{t(`kinds.${kind}Hint`)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {mapping.kind === "split" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {columnSelect("debit_column", t("debitColumn"))}
                  {columnSelect("credit_column", t("creditColumn"))}
                </div>
              ) : (
                columnSelect("amount_column", t("amountColumn"))
              )}
            </div>
          ) : null}

          <div className="mt-4">
            <Button type="button" variant="secondary" disabled={previewing} aria-busy={previewing} onClick={() => send(previewAction)}>
              {previewing ? t("checking") : t("check")}
            </Button>
          </div>
        </section>
      ) : null}

      {error ? <Notice tone="error">{errors(error)}</Notice> : null}

      {file && shown.preview ? (
        <section className="rounded-card bg-surface p-5" data-testid="pratonton-bank">
          <h2 className="text-lg font-bold">{t("step3")}</h2>
          <p className="mt-1" data-testid="pratonton-ringkasan">
            {t("previewSummary", { fresh: shown.preview.fresh, duplicate: shown.preview.duplicate, locked: shown.preview.locked })}
          </p>
          {shown.preview.fresh > 0 ? (
            <p className="mt-1 text-sm text-muted">
              {t("previewTotals", { in: formatSen(shown.preview.in_sen), out: formatSen(shown.preview.out_sen) })}
            </p>
          ) : null}
          {shown.preview.problems.length > 0 ? (
            <div className="mt-3">
              <Notice tone="error">
                {t("problems")}{" "}
                {shown.preview.problems
                  .slice(0, 10)
                  .map((problem) => t("problemLine", { line: problem.line, problem: errors(problem.error) }))
                  .join("; ")}
              </Notice>
            </div>
          ) : null}

          <ul className="mt-3 divide-y divide-rule rounded-chip border border-border">
            {shown.preview.lines.slice(0, 100).map((line) => (
              <li key={line.line} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block text-muted">
                    {formatDay(line.date, locale)}{" "}
                    {line.status === "new" ? (
                      <Badge tone="teal">{t("statusNew")}</Badge>
                    ) : line.status === "duplicate" ? (
                      <Badge tone="plain">{t("statusDuplicate")}</Badge>
                    ) : (
                      <Badge tone="warn">{t("statusLocked")}</Badge>
                    )}
                  </span>
                  <span className="block break-words">{line.description || "—"}</span>
                </span>
                <SignedAmount sen={Math.abs(line.amount_sen)} direction={line.amount_sen > 0 ? "in" : "out"} className="shrink-0 font-semibold" />
              </li>
            ))}
          </ul>
          {shown.preview.lines.length > 100 ? <p className="mt-2 text-sm text-muted">{t("more", { count: shown.preview.lines.length - 100 })}</p> : null}

          <div className="mt-4">
            {shown.preview.fresh > 0 ? (
              <Button type="button" disabled={importing} aria-busy={importing} onClick={() => send(importAction)}>
                {importing ? t("importing") : t("importButton", { count: shown.preview.fresh })}
              </Button>
            ) : (
              <Notice tone="success">{t("nothingNew")}</Notice>
            )}
          </div>
        </section>
      ) : null}
    </form>
  );
}
