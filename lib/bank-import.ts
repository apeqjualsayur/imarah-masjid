// Turns a bank statement CSV into bank lines, using the columns the Bendahari
// chose once for that bank. Works in the browser (to choose columns and show
// a preview) and on the server (which reads the file again before saving).
// Money becomes integer sen without ever passing through a float.

import type { CsvRow } from "./csv";

export const BANK_FILE_MAX_BYTES = 900_000;
export const BANK_LINES_MAX = 5_000;
export const BANK_DESCRIPTION_MAX = 300;
export const BANK_FORMAT_NAME_MAX = 60;
export const DATE_ORDERS = ["dmy", "ymd", "mdy"] as const;
export type DateOrder = (typeof DATE_ORDERS)[number];

export type BankFormat = {
  date_column: string;
  description_columns: string[];
  /** Either debit and credit columns... */
  debit_column: string | null;
  credit_column: string | null;
  /** ...or one signed amount column. */
  amount_column: string | null;
  date_order: DateOrder;
};

export type BankLine = { line: number; date: string; amount_sen: number; description: string };
export type BankProblem = { line: number; error: "bank_date_bad" | "bank_amount_bad" | "bank_both_sides" };
export type BankParse =
  | { ok: true; lines: BankLine[]; problems: BankProblem[] }
  | { ok: false; error: "bank_header_missing" | "bank_no_lines" | "bank_too_many" };

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mac: 3, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  ogo: 8, ogos: 8, aug: 8, sep: 9, sept: 9, okt: 10, oct: 10, nov: 11, dis: 12, dec: 12,
};

const pad = (n: number) => `${n}`.padStart(2, "0");

function validDate(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1) return null;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= days ? `${year}-${pad(month)}-${pad(day)}` : null;
}

/**
 * Reads the dates banks put in statements: 05/11/2026, 5-11-26, 2026-11-05,
 * 05 Nov 2026, 05-NOV-26, 05Nov2026, with or without a time after it.
 * `order` says which number is the day when the month is a number.
 */
export function parseBankDate(value: string, order: DateOrder = "dmy"): string | null {
  const text = value.trim().toLowerCase().replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[ap]m)?$/, "").trim();

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const named = /^(\d{1,2})[\s\-/.]*([a-z]{3,4})[\s\-/.,]*(\d{2}|\d{4})$/.exec(text);
  if (named) {
    const month = MONTHS[named[2]];
    return month ? validDate(Number(named[3]), month, Number(named[1])) : null;
  }

  const numeric = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/.exec(text);
  if (numeric) {
    const [a, b, c] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])];
    if (order === "ymd") return validDate(a, b, c);
    if (order === "mdy") return validDate(c, a, b);
    return validDate(c, b, a);
  }

  const compact = /^(\d{2})(\d{2})(\d{4})$/.exec(text);
  if (compact && order === "dmy") return validDate(Number(compact[3]), Number(compact[2]), Number(compact[1]));
  return null;
}

/**
 * Reads an amount cell: "1,234.50", "RM 1,234.50", "-50.00", "(50.00)",
 * "50.00 CR", "50.00 DR", "50.00-". An empty cell or "-" is zero. Returns sen,
 * negative for money out, or null when it is not an amount.
 */
export function parseBankAmount(value: string): number | null {
  let text = value.trim().toUpperCase().replace(/^RM\s*/, "").replace(/\s+/g, "");
  if (text === "" || text === "-" || text === "–") return 0;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.endsWith("DR")) {
    negative = true;
    text = text.slice(0, -2);
  } else if (text.endsWith("CR")) {
    text = text.slice(0, -2);
  }
  if (text.endsWith("-")) {
    negative = true;
    text = text.slice(0, -1);
  }
  if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }
  text = text.replace(/^RM/, "");

  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.replace(/,/g, "").split(".");
  if (whole.length > 10) return null;
  const sen = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return negative ? -sen : sen;
}

const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/** Where a column is in a header row, matched without case or extra spaces. */
function columnIndex(header: string[], name: string | null) {
  if (!name) return -1;
  return header.findIndex((cell) => normalise(cell) === normalise(name));
}

/** The first row that has every chosen column name. */
export function findHeaderRow(rows: CsvRow[], format: BankFormat): number {
  const names = [format.date_column, ...format.description_columns, format.debit_column, format.credit_column, format.amount_column];
  const wanted = names.filter((name): name is string => !!name);
  return rows.findIndex((row) => wanted.every((name) => columnIndex(row.cells, name) >= 0));
}

/**
 * For a new bank: the row just before the first line that has a date and an
 * amount is taken as the header row. Banks often put account details above it.
 */
export function guessHeaderRow(rows: CsvRow[]): number {
  const first = rows.findIndex(
    (row) =>
      row.cells.some((cell) => parseBankDate(cell) !== null) &&
      row.cells.some((cell) => /\d/.test(cell) && !parseBankDate(cell) && (parseBankAmount(cell) ?? 0) !== 0),
  );
  return first > 0 ? first - 1 : 0;
}

/** Reads every line under the header row with the chosen columns. */
export function readBankLines(rows: CsvRow[], format: BankFormat): BankParse {
  const headerAt = findHeaderRow(rows, format);
  if (headerAt < 0) return { ok: false, error: "bank_header_missing" };
  const header = rows[headerAt].cells;
  const at = (name: string | null) => columnIndex(header, name);
  const dateAt = at(format.date_column);
  const descriptionAt = format.description_columns.map(at);
  const amountAt = at(format.amount_column);
  const debitAt = at(format.debit_column);
  const creditAt = at(format.credit_column);

  const body = rows.slice(headerAt + 1);
  if (body.length > BANK_LINES_MAX) return { ok: false, error: "bank_too_many" };

  const lines: BankLine[] = [];
  const problems: BankProblem[] = [];
  for (const row of body) {
    const cell = (index: number) => (index >= 0 ? (row.cells[index] ?? "") : "");
    const dateCell = cell(dateAt);
    const amountCells = amountAt >= 0 ? [cell(amountAt)] : [cell(debitAt), cell(creditAt)];

    // Lines with no date and no amount are wrapped descriptions, totals or blanks.
    if (!dateCell.trim() && amountCells.every((value) => !value.trim())) continue;
    if (!dateCell.trim()) continue;

    const date = parseBankDate(dateCell, format.date_order);
    if (!date) {
      // A "Total" or "Closing balance" line under the list is not a problem.
      if (amountCells.every((value) => parseBankAmount(value) === 0)) continue;
      if (!/\d/.test(dateCell)) continue;
      problems.push({ line: row.line, error: "bank_date_bad" });
      continue;
    }

    let amount: number | null;
    if (amountAt >= 0) {
      amount = parseBankAmount(amountCells[0]);
    } else {
      const debit = parseBankAmount(amountCells[0]);
      const credit = parseBankAmount(amountCells[1]);
      if (debit === null || credit === null) amount = null;
      else if (debit !== 0 && credit !== 0) {
        problems.push({ line: row.line, error: "bank_both_sides" });
        continue;
      } else amount = Math.abs(credit) - Math.abs(debit);
    }
    if (amount === null) {
      problems.push({ line: row.line, error: "bank_amount_bad" });
      continue;
    }
    // Balance-only lines (opening balance, interest of zero) move no money.
    if (amount === 0) continue;

    const description = descriptionAt
      .map(cell)
      .map((value) => value.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" ")
      .slice(0, BANK_DESCRIPTION_MAX);
    lines.push({ line: row.line, date, amount_sen: amount, description });
  }

  if (lines.length === 0 && problems.length === 0) return { ok: false, error: "bank_no_lines" };
  return { ok: true, lines, problems };
}

/**
 * The duplicate fingerprint: date, amount and description, plus how many
 * identical lines came before it in the same file. Importing the same file
 * again gives the same fingerprints, so nothing is added twice, while two
 * genuine identical payments on one day both stay.
 */
export function fingerprints(lines: Pick<BankLine, "date" | "amount_sen" | "description">[], sha256: (text: string) => string) {
  const seen = new Map<string, number>();
  return lines.map((line) => {
    const key = `${line.date}|${line.amount_sen}|${normalise(line.description)}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return sha256(`${key}|${n}`);
  });
}

export type FormatInput = Record<"name" | "date_column" | "description_1" | "description_2" | "kind" | "debit_column" | "credit_column" | "amount_column" | "date_order", string>;
export type FormatCheck = { ok: true; name: string; format: BankFormat } | { ok: false; error: string };

/** Checks the column choices from the form. */
export function checkFormat(input: FormatInput): FormatCheck {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "bank_format_name_missing" };
  if (name.length > BANK_FORMAT_NAME_MAX) return { ok: false, error: "bank_format_name_too_long" };
  if (!input.date_column) return { ok: false, error: "bank_column_missing" };
  if (!input.description_1) return { ok: false, error: "bank_column_missing" };
  const order = DATE_ORDERS.find((value) => value === input.date_order);
  if (!order) return { ok: false, error: "bank_column_missing" };
  const description_columns = [input.description_1, input.description_2].filter(Boolean);
  const long = [input.date_column, ...description_columns, input.debit_column, input.credit_column, input.amount_column].some(
    (value) => value.length > 100,
  );
  if (long) return { ok: false, error: "bank_column_missing" };

  if (input.kind === "single") {
    if (!input.amount_column) return { ok: false, error: "bank_column_missing" };
    return {
      ok: true,
      name,
      format: { date_column: input.date_column, description_columns, debit_column: null, credit_column: null, amount_column: input.amount_column, date_order: order },
    };
  }
  if (!input.debit_column || !input.credit_column) return { ok: false, error: "bank_column_missing" };
  if (input.debit_column === input.credit_column) return { ok: false, error: "bank_columns_same" };
  return {
    ok: true,
    name,
    format: { date_column: input.date_column, description_columns, debit_column: input.debit_column, credit_column: input.credit_column, amount_column: null, date_order: order },
  };
}

/** A friendly key for import errors from the database. */
export function bankError(error: { code?: string; message?: string } | null): string {
  const message = error?.message ?? "";
  if (message.includes("locked period")) return "locked_month";
  if (message.includes("amount does not match")) return "bank_amount_mismatch";
  if (message.includes("entry is cancelled")) return "bank_entry_cancelled";
  if (message.includes("cash entries")) return "bank_entry_cash";
  if (message.includes("entry already matched") || message.includes("bank_lines_one_per_transaction")) return "bank_entry_taken";
  if (message.includes("already explained")) return "bank_line_taken";
  if (message.includes("import has matched lines")) return "bank_import_matched";
  if (message.includes("not found")) return "not_found";
  if (message.includes("bank_formats_masjid_id_name_key")) return "bank_format_name_taken";
  if (error?.code === "42501") return "not_allowed";
  return "generic";
}
