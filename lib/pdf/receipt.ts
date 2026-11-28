// Draws a receipt as an A5 PDF with pdf-lib (plain JavaScript, nothing
// native, so it bundles and runs anywhere). Server only: it reads the font
// files from disk. Not marked "server-only" so the PDF smoke test can run it
// outside Next.js.

import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { degrees, PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import tokens from "@/_brand/tokens.json";
import { senInMalayWords } from "@/lib/amount-words";
import { formatSen } from "@/lib/money";

/** Everything printed on one receipt. Text arrives already translated. */
export type ReceiptData = {
  masjidName: string;
  area: string;
  initials: string;
  /** PNG bytes of the logo, or null to show the initials. */
  logo: Buffer | null;
  receiptNo: string;
  date: string;
  receivedFrom: string | null;
  fund: string;
  method: string;
  amountSen: number;
  cancelled: boolean;
  showCredit: boolean;
  /** The masjid's DuitNow QR, when it chose to print it on receipts. */
  qr: { path: string; size: number } | null;
};

export type ReceiptLabels = {
  title: string;
  number: string;
  date: string;
  from: string;
  fund: string;
  method: string;
  total: string;
  inWords: string;
  thanks: string;
  signature: string;
  credit: string;
  cancelled: string;
  cancelledNote: string;
  qr: string;
};

const FONT_DIR = path.join(process.cwd(), "lib", "pdf", "fonts");
let fontFiles: Promise<Record<"regular" | "semibold" | "bold", Uint8Array>> | null = null;

function loadFontFiles() {
  fontFiles ??= Promise.all(
    ["400", "600", "700"].map((weight) => readFile(path.join(FONT_DIR, `PlusJakartaSans-${weight}.woff`))),
  ).then(([regular, semibold, bold]) => ({ regular, semibold, bold }));
  return fontFiles;
}

function hex(value: string): RGB {
  const n = parseInt(value.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const C = Object.fromEntries(Object.entries(tokens.color).map(([name, value]) => [name, hex(value)])) as Record<
  keyof typeof tokens.color,
  RGB
>;

// A5 in points, with the same margins as the e-receipt board.
const WIDTH = 419.53;
const HEIGHT = 595.28;
const MARGIN = 36;
const CONTENT = WIDTH - MARGIN * 2;

type Fonts = { regular: PDFFont; semibold: PDFFont; bold: PDFFont };

/** Splits text into lines that fit `width`, breaking at spaces (or inside a very long word). */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** Draws from the top of the page down, so positions read like the design. */
class Sheet {
  constructor(
    readonly page: PDFPage,
    readonly fonts: Fonts,
  ) {}

  text(text: string, x: number, top: number, size: number, font: PDFFont, color: RGB, opacity = 1) {
    this.page.drawText(text, { x, y: HEIGHT - top - size * 0.8, size, font, color, opacity });
  }

  right(text: string, rightEdge: number, top: number, size: number, font: PDFFont, color: RGB) {
    this.text(text, rightEdge - font.widthOfTextAtSize(text, size), top, size, font, color);
  }

  roundedBox(x: number, top: number, width: number, height: number, radius: number, color: RGB) {
    const r = Math.min(radius, height / 2, width / 2);
    const d = `M ${r} 0 H ${width - r} A ${r} ${r} 0 0 1 ${width} ${r} V ${height - r} A ${r} ${r} 0 0 1 ${width - r} ${height} H ${r} A ${r} ${r} 0 0 1 0 ${height - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    this.page.drawSvgPath(d, { x, y: HEIGHT - top, color, borderWidth: 0 });
  }

  line(x: number, top: number, width: number, color: RGB, thickness = 1) {
    this.page.drawLine({ start: { x, y: HEIGHT - top }, end: { x: x + width, y: HEIGHT - top }, thickness, color });
  }
}

/** The receipt as PDF bytes. Matches the e-receipt board in _brand/screens/. */
export async function renderReceiptPdf(data: ReceiptData, labels: ReceiptLabels): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${data.receiptNo} · ${data.masjidName}`);
  doc.setAuthor(data.masjidName);
  doc.setCreator("Imarah");
  doc.setProducer("Imarah");

  const files = await loadFontFiles();
  const fonts: Fonts = {
    regular: await doc.embedFont(files.regular, { subset: true }),
    semibold: await doc.embedFont(files.semibold, { subset: true }),
    bold: await doc.embedFont(files.bold, { subset: true }),
  };
  const page = doc.addPage([WIDTH, HEIGHT]);
  const s = new Sheet(page, fonts);

  // Header: logo (or initials) and the masjid's name and area.
  const logoSize = 44;
  if (data.logo) {
    const image = await doc.embedPng(data.logo);
    const scale = Math.min(logoSize / image.width, logoSize / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, { x: MARGIN + (logoSize - w) / 2, y: HEIGHT - MARGIN - logoSize + (logoSize - h) / 2, width: w, height: h });
  } else {
    page.drawCircle({ x: MARGIN + logoSize / 2, y: HEIGHT - MARGIN - logoSize / 2, size: logoSize / 2, color: C.tint });
    const size = 15;
    const width = fonts.bold.widthOfTextAtSize(data.initials, size);
    s.text(data.initials, MARGIN + (logoSize - width) / 2, MARGIN + (logoSize - size) / 2 + 1, size, fonts.bold, C.primaryDark);
  }

  const nameX = MARGIN + logoSize + 12;
  const nameWidth = WIDTH - MARGIN - nameX;
  const nameLines = wrap(data.masjidName, fonts.bold, 15, nameWidth).slice(0, 2);
  const nameHeight = nameLines.length * 18 + (data.area ? 13 : 0);
  let top = MARGIN + Math.max(0, (logoSize - nameHeight) / 2);
  for (const line of nameLines) {
    s.text(line, nameX, top, 15, fonts.bold, C.ink);
    top += 18;
  }
  if (data.area) s.text(wrap(data.area, fonts.regular, 9, nameWidth)[0], nameX, top + 1, 9, fonts.regular, C.muted);

  top = Math.max(MARGIN + logoSize, top + 13) + 14;
  s.line(MARGIN, top, CONTENT, C.rule);

  // Title, with a BATAL badge on a cancelled receipt.
  top += 16;
  s.text(labels.title, MARGIN, top, 12, fonts.bold, C.ink);
  if (data.cancelled) {
    const size = 8;
    const width = fonts.bold.widthOfTextAtSize(labels.cancelled, size) + 16;
    s.roundedBox(WIDTH - MARGIN - width, top - 1, width, 16, 8, C.warnBg);
    s.right(labels.cancelled, WIDTH - MARGIN - 8, top + 3, size, fonts.bold, C.warnInk);
  }
  top += 24;

  // Details.
  const rows: [string, string][] = [
    [labels.number, data.receiptNo],
    [labels.date, data.date],
    [labels.from, data.receivedFrom || "—"],
    [labels.fund, data.fund],
    [labels.method, data.method],
  ];
  for (const [label, value] of rows) {
    s.text(label, MARGIN, top, 10, fonts.regular, C.muted);
    for (const line of wrap(value, fonts.semibold, 10, CONTENT * 0.65)) {
      s.right(line, WIDTH - MARGIN, top, 10, fonts.semibold, C.ink);
      top += 13;
    }
    top += 6;
  }

  // Total, in figures and in words.
  top += 6;
  const words = wrap(`${labels.inWords} ${senInMalayWords(data.amountSen)}`, fonts.regular, 9, CONTENT - 28);
  const boxHeight = 14 + 26 + 8 + words.length * 12 + 12;
  s.roundedBox(MARGIN, top, CONTENT, boxHeight, 12, C.background);
  const figure = formatSen(data.amountSen).replace("RM ", "");
  const figureWidth = fonts.bold.widthOfTextAtSize(figure, 22);
  s.text(labels.total, MARGIN + 14, top + 26, 10, fonts.regular, C.muted);
  s.text(figure, WIDTH - MARGIN - 14 - figureWidth, top + 14, 22, fonts.bold, C.ink);
  s.right("RM ", WIDTH - MARGIN - 14 - figureWidth, top + 24, 11, fonts.semibold, C.muted);
  let wordsTop = top + 14 + 26 + 8;
  for (const [i, line] of words.entries()) {
    if (i === 0 && line.startsWith(labels.inWords)) {
      s.text(labels.inWords, MARGIN + 14, wordsTop, 9, fonts.regular, C.muted);
      const rest = line.slice(labels.inWords.length);
      s.text(rest, MARGIN + 14 + fonts.regular.widthOfTextAtSize(labels.inWords, 9), wordsTop, 9, fonts.regular, C.ink);
    } else {
      s.text(line, MARGIN + 14, wordsTop, 9, fonts.regular, C.ink);
    }
    wordsTop += 12;
  }
  top += boxHeight + 16;

  // Thanks, or why the receipt is no longer valid.
  const closing = data.cancelled ? labels.cancelledNote : labels.thanks;
  for (const line of wrap(closing, data.cancelled ? fonts.semibold : fonts.regular, 10, CONTENT)) {
    s.text(line, MARGIN, top, 10, data.cancelled ? fonts.semibold : fonts.regular, data.cancelled ? C.warnInk : C.muted);
    top += 15;
  }

  // The DuitNow QR on the right, for the next donation. Not on a cancelled copy.
  if (data.qr && !data.cancelled) {
    const box = 76;
    const x = WIDTH - MARGIN - box;
    const scale = box / data.qr.size;
    page.drawRectangle({ x, y: HEIGHT - top - box, width: box, height: box, color: C.surface });
    page.drawSvgPath(data.qr.path, { x, y: HEIGHT - top, scale, color: C.ink, borderWidth: 0 });
    const label = wrap(labels.qr, fonts.regular, 7, box + 20)[0];
    s.text(label, x + (box - fonts.regular.widthOfTextAtSize(label, 7)) / 2, top + box + 3, 7, fonts.regular, C.muted);
  }

  // Signature line for the Bendahari.
  top += 48;
  s.line(MARGIN, top, 170, C.ink);
  s.text(labels.signature, MARGIN, top + 5, 9, fonts.regular, C.muted);

  if (data.showCredit) s.text(labels.credit, MARGIN, HEIGHT - 24 - 8, 8, fonts.regular, C.muted);

  // A cancelled copy carries a large diagonal BATAL across the page.
  if (data.cancelled) {
    const size = 96;
    const width = fonts.bold.widthOfTextAtSize(labels.cancelled, size);
    const angle = (30 * Math.PI) / 180;
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2 - 20;
    page.drawText(labels.cancelled, {
      x: cx - (Math.cos(angle) * width) / 2 + (Math.sin(angle) * size * 0.35),
      y: cy - (Math.sin(angle) * width) / 2 - (Math.cos(angle) * size * 0.35),
      size,
      font: fonts.bold,
      color: C.warnInk,
      opacity: 0.16,
      rotate: degrees(30),
    });
  }

  return Buffer.from(await doc.save({ useObjectStreams: false }));
}
