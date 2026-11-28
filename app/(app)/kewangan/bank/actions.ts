"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BANK_FILE_MAX_BYTES,
  bankError,
  checkFormat,
  fingerprints,
  readBankLines,
  type BankFormat,
  type BankProblem,
  type FormatInput,
} from "@/lib/bank-import";
import { parseCsv } from "@/lib/csv";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadFormats, lockedMonths } from "./data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Where a bank action may send the Bendahari back to. Bound arguments come from the browser.
const BACK = /^\/kewangan\/bank(\/[0-9a-f-]{36}|\/import)?(\?bulan=\d{4}-\d{2})?$/;
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export type PreviewLine = { line: number; date: string; amount_sen: number; description: string; status: "new" | "duplicate" | "locked" };
export type ImportState = {
  error?: string;
  /** Echoes what the preview was made from, so the form can hide a stale one. */
  stamp?: string;
  preview?: { lines: PreviewLine[]; problems: BankProblem[]; fresh: number; duplicate: number; locked: number; in_sen: number; out_sen: number };
};

const FORMAT_FIELDS = ["name", "date_column", "description_1", "description_2", "kind", "debit_column", "credit_column", "amount_column", "date_order"] as const;

/** The saved format chosen, or the new column choices typed in. */
async function formatFrom(form: FormData): Promise<{ ok: true; format: BankFormat; id: string | null; name: string | null } | { ok: false; error: string }> {
  const id = text(form, "format_id");
  if (id && id !== "baru") {
    const saved = (await loadFormats()).find((format) => format.id === id);
    return saved ? { ok: true, format: saved, id: saved.id, name: null } : { ok: false, error: "not_found" };
  }
  const input = Object.fromEntries(FORMAT_FIELDS.map((field) => [field, text(form, field)])) as FormatInput;
  const check = checkFormat(input);
  return check.ok ? { ok: true, format: check.format, id: null, name: check.name } : check;
}

/**
 * Reads the file with the chosen columns and sorts every line into new,
 * already imported, or in a locked month. The server reads the file itself;
 * nothing the browser worked out is trusted.
 */
async function prepare(form: FormData) {
  const csv = String(form.get("csv") ?? "");
  if (!csv.trim()) return { ok: false as const, error: "bank_file_missing" };
  if (new TextEncoder().encode(csv).length > BANK_FILE_MAX_BYTES) return { ok: false as const, error: "bank_file_too_big" };

  const format = await formatFrom(form);
  if (!format.ok) return format;
  const parsed = readBankLines(parseCsv(csv), format.format);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const hashes = fingerprints(parsed.lines, sha256);
  const supabase = await createClient();
  const existing = new Set<string>();
  for (let at = 0; at < hashes.length; at += 100) {
    const { data, error } = await supabase.from("bank_lines").select("line_hash").in("line_hash", hashes.slice(at, at + 100));
    if (error) return { ok: false as const, error: "generic" };
    for (const row of data ?? []) existing.add(row.line_hash as string);
  }
  const locked = await lockedMonths();

  const lines = parsed.lines.map((line, i) => ({
    ...line,
    hash: hashes[i],
    status: (existing.has(hashes[i]) ? "duplicate" : locked.has(line.date.slice(0, 7)) ? "locked" : "new") as PreviewLine["status"],
  }));
  return { ok: true as const, lines, problems: parsed.problems, format };
}

/** Shows what an import would add, without saving anything. */
export async function previewBankImport(_: ImportState, form: FormData): Promise<ImportState> {
  await requireMember("bank.match");
  const stamp = text(form, "stamp");
  const prepared = await prepare(form);
  if (!prepared.ok) return { error: prepared.error, stamp };

  const fresh = prepared.lines.filter((line) => line.status === "new");
  return {
    stamp,
    preview: {
      lines: prepared.lines.map((line) => ({ line: line.line, date: line.date, amount_sen: line.amount_sen, description: line.description, status: line.status })),
      problems: prepared.problems,
      fresh: fresh.length,
      duplicate: prepared.lines.filter((line) => line.status === "duplicate").length,
      locked: prepared.lines.filter((line) => line.status === "locked").length,
      in_sen: fresh.filter((line) => line.amount_sen > 0).reduce((sum, line) => sum + line.amount_sen, 0),
      out_sen: fresh.filter((line) => line.amount_sen < 0).reduce((sum, line) => sum - line.amount_sen, 0),
    },
  };
}

/** Saves the new lines (and a new bank's column choices), then opens that month's reconciliation. */
export async function importBankStatement(_: ImportState, form: FormData): Promise<ImportState> {
  await requireMember("bank.match");
  const fileName = text(form, "file_name").slice(0, 200) || "penyata.csv";
  const prepared = await prepare(form);
  if (!prepared.ok) return { error: prepared.error };

  const fresh = prepared.lines.filter((line) => line.status === "new");
  if (fresh.length === 0) return { error: "bank_nothing_new" };

  const supabase = await createClient();
  let formatId = prepared.format.id;
  if (!formatId && prepared.format.name) {
    const { data, error } = await supabase
      .from("bank_formats")
      .insert({ name: prepared.format.name, ...prepared.format.format })
      .select("id")
      .single();
    if (error || !data) return { error: error?.code === "23505" ? "bank_format_name_taken" : bankError(error) };
    formatId = data.id;
  }

  const { data, error } = await supabase.rpc("import_bank_lines", {
    p_format_id: formatId,
    p_file_name: fileName,
    p_lines: fresh.map((line) => ({ date: line.date, amount_sen: line.amount_sen, description: line.description, hash: line.hash })),
  });
  if (error) return { error: bankError(error) };
  const result = ((data ?? []) as { added: number; skipped: number }[])[0];

  revalidatePath("/kewangan/bank");
  const month = fresh.map((line) => line.date).sort()[0].slice(0, 7);
  redirect(`/kewangan/bank?bulan=${month}&import=${result?.added ?? 0}`);
}

// Matching -------------------------------------------------------------------------

/** Runs one bank function, then returns to where the Bendahari was. */
async function run(back: string, fn: string, args: Record<string, string>) {
  await requireMember("bank.match");
  const target = BACK.test(back) ? back : "/kewangan/bank";
  if (Object.values(args).some((value) => !UUID.test(value))) redirect(`${target}${target.includes("?") ? "&" : "?"}ralat=not_found`);

  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  revalidatePath("/kewangan/bank");
  const join = target.includes("?") ? "&" : "?";
  redirect(error ? `${target}${join}ralat=${bankError(error)}` : `${target}${join}ok=${fn}`);
}


export async function acceptMatch(back: string, lineId: string, entryId: string) {
  await run(back, "match_bank_line", { p_line_id: lineId, p_transaction_id: entryId });
}

export async function rejectSuggestion(back: string, lineId: string, entryId: string) {
  await run(back, "reject_bank_suggestion", { p_line_id: lineId, p_transaction_id: entryId });
}

export async function markCash(back: string, lineId: string) {
  await run(back, "mark_bank_cash", { p_line_id: lineId });
}

export async function clearLine(back: string, lineId: string) {
  await run(back, "clear_bank_line", { p_line_id: lineId });
}

export async function cancelImport(importId: string) {
  await run("/kewangan/bank/import", "cancel_bank_import", { p_import_id: importId });
}

