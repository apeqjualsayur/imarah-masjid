// A small CSV reader and writer that copes with files saved by Excel:
// UTF-8 with or without the byte-order mark, Excel's Windows-1252, commas or
// semicolons, quoted cells with commas or line breaks, and CRLF line ends.

/** Turns file bytes into text: UTF-8 if it is valid, else Windows-1252. */
export function decodeCsv(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.replace(/^﻿/, "");
}

/** The separator used most in the first line, outside quotes. */
function detectDelimiter(text: string) {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && char in counts) counts[char as keyof typeof counts] += 1;
  }
  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? best : ",";
}

export type CsvRow = { line: number; cells: string[] };

/**
 * Splits CSV text into rows of cells. Each row remembers the line it started
 * on, so errors can point to the right line in Excel. Empty rows are dropped.
 */
export function parseCsv(text: string): CsvRow[] {
  const delimiter = detectDelimiter(text);
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowStart = 1;

  const endRow = () => {
    cells.push(cell);
    if (cells.some((value) => value.trim() !== "")) rows.push({ line: rowStart, cells: cells.map((v) => v.trim()) });
    cells = [];
    cell = "";
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        if (char === "\n") line += 1;
        cell += char;
      }
    } else if (char === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (char === delimiter) {
      cells.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      endRow();
      line += 1;
      rowStart = line;
    } else {
      cell += char;
    }
  }
  if (cell !== "" || cells.length > 0) endRow();
  return rows;
}

/** Writes rows as CSV with the byte-order mark, so Excel opens it as UTF-8. */
export function toCsv(rows: string[][]) {
  const quote = (value: string) => (/[",\r\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return `﻿${rows.map((row) => row.map(quote).join(",")).join("\r\n")}\r\n`;
}
