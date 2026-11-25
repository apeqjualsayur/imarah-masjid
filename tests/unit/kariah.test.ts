import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeCsv, parseCsv, toCsv } from "@/lib/csv";
import { describeChanges } from "@/lib/history";
import { ageOn, icLast4, isValidBirthDate, matchKey } from "@/lib/kariah";
import { checkImport, templateCsv } from "@/lib/kariah-import";
import { formatPhone, normalisePhone, whatsappLink } from "@/lib/phone";
import { withinLimit } from "@/lib/plan-limits";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("reading CSV files", () => {
  it("drops Excel's byte-order mark and handles CRLF", () => {
    const text = decodeCsv(bytes("﻿nama,telefon\r\nAli,0123456789\r\n"));
    expect(parseCsv(text).map((row) => row.cells)).toEqual([
      ["nama", "telefon"],
      ["Ali", "0123456789"],
    ]);
  });

  it("reads Excel's Windows-1252 files", () => {
    // "Zulkiflé" saved by Excel as ANSI: é is the single byte 0xE9.
    const ansi = new Uint8Array([...bytes("nama\r\nZulkifl"), 0xe9, ...bytes("\r\n")]);
    expect(parseCsv(decodeCsv(ansi))[1].cells).toEqual(["Zulkiflé"]);
  });

  it("detects semicolons, as saved by Excel in some regions", () => {
    expect(parseCsv("nama;alamat\nAli;1, Jalan A\n")[1].cells).toEqual(["Ali", "1, Jalan A"]);
  });

  it("handles quoted cells with commas, quotes and line breaks", () => {
    const rows = parseCsv('nama,alamat\n"Ali ""Pak Li""","12 Jalan A,\nTaman B"\nAbu,3 Jalan C\n');
    expect(rows[1].cells).toEqual(['Ali "Pak Li"', "12 Jalan A,\nTaman B"]);
    expect(rows[2]).toEqual({ line: 4, cells: ["Abu", "3 Jalan C"] });
  });

  it("skips blank rows and trims cells, keeping true line numbers", () => {
    const rows = parseCsv("nama,telefon\n\n,,\n  Ali  , 012 \n");
    expect(rows.map((row) => [row.line, row.cells])).toEqual([
      [1, ["nama", "telefon"]],
      [4, ["Ali", "012"]],
    ]);
  });

  it("writes CSV that reads back the same", () => {
    const rows = [["a", 'b "c"', "d,e"], ["1", "2", "3"]];
    expect(parseCsv(decodeCsv(bytes(toCsv(rows)))).map((row) => row.cells)).toEqual(rows);
  });
});

describe("phone numbers", () => {
  it.each([
    ["012-345 6789", "0123456789"],
    ["011-1234 5678", "01112345678"],
    ["+60 12-345 6789", "0123456789"],
    ["60123456789", "0123456789"],
    ["123456789", "0123456789"], // Excel dropped the leading 0
    ["03-5512 3456", "0355123456"],
    ["(082) 123 456", "082123456"],
    ["", null],
  ])("%s -> %s", (input, expected) => {
    expect(normalisePhone(input)).toEqual({ ok: true, value: expected });
  });

  it.each(["012-34", "abc", "0123456789012", "12"])("refuses %s", (input) => {
    expect(normalisePhone(input)).toEqual({ ok: false, error: "phone_bad" });
  });

  it("spots numbers Excel turned into 1.23E+09", () => {
    expect(normalisePhone("1.23457E+09")).toEqual({ ok: false, error: "phone_excel" });
    expect(normalisePhone("1,23457E+09")).toEqual({ ok: false, error: "phone_excel" });
  });

  it("formats and links", () => {
    expect(formatPhone("0123456789")).toBe("012-345 6789");
    expect(formatPhone("01112345678")).toBe("011-1234 5678");
    expect(formatPhone("0355123456")).toBe("03-5512 3456");
    expect(whatsappLink("0123456789")).toBe("https://wa.me/60123456789");
    expect(whatsappLink("0355123456")).toBeNull();
  });
});

describe("IC numbers", () => {
  it("keeps only the last 4 digits, even of a full IC", () => {
    expect(icLast4("1234")).toEqual({ ok: true, value: "1234" });
    expect(icLast4("850101-14-5678")).toEqual({ ok: true, value: "5678" });
    expect(icLast4("850101145678")).toEqual({ ok: true, value: "5678" });
    expect(icLast4("")).toEqual({ ok: true, value: null });
  });

  it("refuses anything else", () => {
    expect(icLast4("123")).toEqual({ ok: false });
    expect(icLast4("12a4")).toEqual({ ok: false });
    expect(icLast4("123456")).toEqual({ ok: false });
  });
});

describe("dates of birth and age", () => {
  const today = new Date("2026-11-25T00:00:00Z");
  it("checks the date", () => {
    expect(isValidBirthDate("1985-02-28", today)).toBe(true);
    expect(isValidBirthDate("1985-02-30", today)).toBe(false);
    expect(isValidBirthDate("2030-01-01", today)).toBe(false);
    expect(isValidBirthDate("1850-01-01", today)).toBe(false);
  });

  it("counts age by birthday", () => {
    expect(ageOn("1985-11-25", today)).toBe(41);
    expect(ageOn("1985-11-26", today)).toBe(40);
  });
});

describe("checking an import", () => {
  const header = "nama_ketua,alamat,telefon,whatsapp,pdpa\n";

  it("accepts the template as it is", () => {
    const check = checkImport(decodeCsv(bytes(templateCsv())), []);
    expect(check).toMatchObject({ ok: true, valid: 2, invalid: 0 });
  });

  it("understands English and spaced headers in any order", () => {
    const check = checkImport("Phone, Name ,Address\n0123456789,Ali,1 Jalan A\n", []);
    expect(check.ok && check.rows[0]).toMatchObject({ head_name: "Ali", phone: "0123456789", address: "1 Jalan A" });
  });

  it("needs a name column", () => {
    expect(checkImport("alamat,telefon\n1 Jalan A,0123456789\n", [])).toEqual({ ok: false, error: "csv_no_name_column" });
    expect(checkImport(header, [])).toEqual({ ok: false, error: "csv_empty" });
  });

  it("flags each problem on its own line", () => {
    const check = checkImport(
      header +
        ",1 Jalan A,0123456789,ya,ya\n" +
        "Abu,2 Jalan B,012-34,tidak,ya\n" +
        "Siti,3 Jalan C,1.23E+09,tidak,ya\n" +
        "Ali,4 Jalan D,0191234567,mungkin,ya\n" +
        "Osman,5 Jalan E,03-5512 3456,ya,ya\n",
      [],
    );
    if (!check.ok) throw new Error("expected ok");
    expect(check.rows.map((row) => [row.line, row.errors])).toEqual([
      [2, ["name_missing"]],
      [3, ["phone_bad"]],
      [4, ["phone_excel"]],
      [5, ["consent_bad"]],
      [6, ["whatsapp_needs_mobile"]],
    ]);
    expect(check.valid).toBe(0);
  });

  it("finds duplicates in the file and in the registry", () => {
    const check = checkImport(
      header +
        "Ali bin Abu,1 Jalan A,0123456789,ya,ya\n" +
        "ALI  BIN ABU,1 jalan a.,,tidak,ya\n" + // same name and address, different case and spacing
        "Lain,9 Jalan Z,+60 12-345 6789,tidak,ya\n" + // same phone, other format
        "Kassim,7 Jalan K,0177777777,tidak,ya\n",
      [{ head_name: "Kassim", address: "Lain", phone: "0177777777" }],
    );
    if (!check.ok) throw new Error("expected ok");
    expect(check.rows.map((row) => row.errors)).toEqual([[], ["dup_in_file"], ["dup_in_file"], ["dup_existing"]]);
  });

  it("the 50-household sample finds exactly its 6 planted mistakes", () => {
    const text = decodeCsv(readFileSync("tests/fixtures/kariah-contoh-50.csv"));
    const check = checkImport(text, []);
    if (!check.ok) throw new Error("expected ok");
    expect(check.valid).toBe(44);
    expect(
      check.rows.filter((row) => row.errors.length).map((row) => [row.line, row.errors[0]]),
    ).toEqual([
      [6, "name_missing"],
      [13, "phone_bad"],
      [19, "phone_excel"],
      [26, "dup_in_file"],
      [32, "consent_bad"],
      [41, "whatsapp_needs_mobile"],
    ]);
    // Repaired rather than refused:
    const onLine = (line: number) => check.rows.find((row) => row.line === line)!;
    expect(onLine(8).phone).toBe("0123456789");
    expect(onLine(10).phone).toBe("0198765432");
    expect(onLine(12).head_name).toBe("Hassan bin Daud");
  });
});

describe("matching names", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(matchKey("  Ali   BIN Abu. ")).toBe(matchKey("ali bin abu"));
  });
});

describe("the change history", () => {
  it("shows values for consent, and only 'changed' for personal fields", () => {
    const changes = describeChanges(
      { head_name: "[changed]", phone: "[hidden]", whatsapp_opt_in: false, whatsapp_consent_at: null, updated_at: "x" },
      { head_name: "[changed]", phone: "[hidden]", whatsapp_opt_in: true, whatsapp_consent_at: "2026-11-25T03:00:00+00:00", updated_at: "y" },
    );
    expect(changes).toEqual([
      { field: "head_name", personal: true, from: null, to: null },
      { field: "whatsapp_opt_in", personal: false, from: "✗", to: "✓" },
      { field: "whatsapp_consent_at", personal: false, from: null, to: "2026-11-25" },
    ]);
  });

  it("shows nothing for inserts and deletes", () => {
    expect(describeChanges(null, { head_name: "[hidden]" })).toEqual([]);
  });
});

describe("plan limits", () => {
  it("Asas stops at 150 households", () => {
    expect(withinLimit("asas", "households", 149, 1)).toMatchObject({ allowed: true, room: 1 });
    expect(withinLimit("asas", "households", 150, 1)).toMatchObject({ allowed: false, room: 0 });
    expect(withinLimit("asas", "households", 100, 51)).toMatchObject({ allowed: false, room: 50 });
  });

  it("other plans have no household limit yet", () => {
    expect(withinLimit("standard", "households", 5000, 100)).toMatchObject({ allowed: true, limit: null });
  });
});
