// Checks a kariah CSV row by row before anything is saved. The same function
// runs for the preview and again on confirm, so the server never trusts what
// the browser shows.

import { parseCsv, toCsv } from "./csv";
import { ADDRESS_MAX, matchKey, NAME_MAX } from "./kariah";
import { normalisePhone } from "./phone";

export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_BYTES = 1024 * 1024;

type Field = "head_name" | "address" | "phone" | "whatsapp" | "pdpa";

// Header names people are likely to type, in BM and English.
const HEADER_ALIASES: Record<Field, string[]> = {
  head_name: ["nama_ketua", "nama_ketua_keluarga", "ketua", "nama", "head_name", "name", "head"],
  address: ["alamat", "address"],
  phone: ["telefon", "no_telefon", "no_tel", "tel", "telefon_bimbit", "phone", "phone_number", "mobile"],
  whatsapp: ["whatsapp", "wa", "setuju_whatsapp"],
  pdpa: ["pdpa", "persetujuan_pdpa", "setuju_pdpa", "consent"],
};

export const TEMPLATE_HEADERS = ["nama_ketua", "alamat", "telefon", "whatsapp", "pdpa"];

export function templateCsv() {
  return toCsv([
    TEMPLATE_HEADERS,
    ["Ahmad bin Ali", "12 Jalan Contoh, Taman Contoh", "012-345 6789", "ya", "ya"],
    ["Siti binti Hassan", "8 Lorong Contoh", "0198765432", "tidak", "ya"],
  ]);
}

const normaliseHeader = (value: string) => value.toLowerCase().trim().replace(/[\s.\-/]+/g, "_").replace(/_+$/, "");

function mapHeaders(cells: string[]) {
  const columns: Partial<Record<Field, number>> = {};
  cells.forEach((cell, index) => {
    const header = normaliseHeader(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [Field, string[]][]) {
      if (columns[field] === undefined && aliases.includes(header)) columns[field] = index;
    }
  });
  return columns;
}

const YES = ["ya", "y", "yes", "1", "true", "setuju", "✓"];
const NO = ["tidak", "t", "tak", "no", "n", "0", "false", ""];

function yesNo(value: string): boolean | null {
  const key = value.trim().toLowerCase();
  if (YES.includes(key)) return true;
  if (NO.includes(key)) return false;
  return null;
}

export type ImportError =
  | "name_missing"
  | "name_too_long"
  | "address_too_long"
  | "phone_bad"
  | "phone_excel"
  | "consent_bad"
  | "whatsapp_needs_mobile"
  | "dup_in_file"
  | "dup_existing";

export type ImportRow = {
  line: number;
  head_name: string;
  address: string | null;
  phone: string | null;
  whatsapp: boolean;
  pdpa: boolean;
  errors: ImportError[];
};

export type ExistingHousehold = { head_name: string; address: string | null; phone: string | null };

export type ImportCheck =
  | { ok: false; error: "csv_empty" | "csv_no_name_column" | "csv_too_many_rows" }
  | { ok: true; rows: ImportRow[]; valid: number; invalid: number };

/** Same phone, or same name and address, counts as the same household. */
const keysOf = (row: { head_name: string; address: string | null; phone: string | null }) => [
  ...(row.phone ? [`tel:${row.phone}`] : []),
  `nama:${matchKey(row.head_name)}|${matchKey(row.address)}`,
];

export function checkImport(text: string, existing: ExistingHousehold[]): ImportCheck {
  const [header, ...body] = parseCsv(text);
  if (!header || body.length === 0) return { ok: false, error: "csv_empty" };
  if (body.length > IMPORT_MAX_ROWS) return { ok: false, error: "csv_too_many_rows" };

  const columns = mapHeaders(header.cells);
  if (columns.head_name === undefined) return { ok: false, error: "csv_no_name_column" };

  const known = new Set(existing.flatMap((household) => keysOf({ ...household, phone: household.phone })));
  const seen = new Set<string>();

  const rows = body.map(({ line, cells }) => {
    const cell = (field: Field) => (columns[field] === undefined ? "" : (cells[columns[field]!] ?? ""));
    const errors: ImportError[] = [];

    const head_name = cell("head_name").replace(/\s+/g, " ");
    if (!head_name) errors.push("name_missing");
    else if (head_name.length > NAME_MAX) errors.push("name_too_long");

    const address = cell("address").replace(/\s*\n\s*/g, ", ") || null;
    if (address && address.length > ADDRESS_MAX) errors.push("address_too_long");

    const phoneResult = normalisePhone(cell("phone"));
    const phone = phoneResult.ok ? phoneResult.value : null;
    if (!phoneResult.ok) errors.push(phoneResult.error);

    const whatsapp = yesNo(cell("whatsapp"));
    const pdpa = yesNo(cell("pdpa"));
    if (whatsapp === null || pdpa === null) errors.push("consent_bad");
    if (whatsapp && phoneResult.ok && !phone?.startsWith("01")) errors.push("whatsapp_needs_mobile");

    if (head_name) {
      const keys = keysOf({ head_name, address, phone });
      if (keys.some((key) => known.has(key))) errors.push("dup_existing");
      else if (keys.some((key) => seen.has(key))) errors.push("dup_in_file");
      keys.forEach((key) => seen.add(key));
    }

    return { line, head_name, address, phone, whatsapp: !!whatsapp, pdpa: !!pdpa, errors };
  });

  const valid = rows.filter((row) => row.errors.length === 0).length;
  return { ok: true, rows, valid, invalid: rows.length - valid };
}
