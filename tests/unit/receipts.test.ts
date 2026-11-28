import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { numberInMalay, senInMalayWords } from "@/lib/amount-words";
import { renderReceiptPdf, type ReceiptData, type ReceiptLabels } from "@/lib/pdf/receipt";
import { qrShape } from "@/lib/qr";
import { makeReceiptToken, readReceiptToken } from "@/lib/receipt-link";

describe("numberInMalay", () => {
  it.each([
    [0, "kosong"],
    [1, "satu"],
    [9, "sembilan"],
    [10, "sepuluh"],
    [11, "sebelas"],
    [12, "dua belas"],
    [19, "sembilan belas"],
    [20, "dua puluh"],
    [21, "dua puluh satu"],
    [99, "sembilan puluh sembilan"],
    [100, "seratus"],
    [101, "seratus satu"],
    [110, "seratus sepuluh"],
    [111, "seratus sebelas"],
    [250, "dua ratus lima puluh"],
    [1000, "seribu"],
    [1001, "seribu satu"],
    [1100, "seribu seratus"],
    [2000, "dua ribu"],
    [11000, "sebelas ribu"],
    [100000, "seratus ribu"],
    [250000, "dua ratus lima puluh ribu"],
    [1000000, "sejuta"],
    [1000001, "sejuta satu"],
    [2500000, "dua juta lima ratus ribu"],
    [10000000, "sepuluh juta"],
    [1234567, "sejuta dua ratus tiga puluh empat ribu lima ratus enam puluh tujuh"],
  ])("%i -> %s", (n, words) => {
    expect(numberInMalay(n)).toBe(words);
  });

  it("refuses fractions and negatives", () => {
    expect(() => numberInMalay(1.5)).toThrow(RangeError);
    expect(() => numberInMalay(-1)).toThrow(RangeError);
  });
});

describe("senInMalayWords", () => {
  it.each([
    [1, "Satu sen sahaja"],
    [50, "Lima puluh sen sahaja"],
    [100, "Satu ringgit sahaja"],
    [10000, "Seratus ringgit sahaja"],
    [12050, "Seratus dua puluh ringgit dan lima puluh sen sahaja"],
    [100000, "Seribu ringgit sahaja"],
    [123456, "Seribu dua ratus tiga puluh empat ringgit dan lima puluh enam sen sahaja"],
    [1_000_000_000, "Sepuluh juta ringgit sahaja"],
  ])("%i sen -> %s", (sen, words) => {
    expect(senInMalayWords(sen)).toBe(words);
  });

  it("refuses zero, negatives and floats", () => {
    expect(() => senInMalayWords(0)).toThrow(RangeError);
    expect(() => senInMalayWords(-100)).toThrow(RangeError);
    expect(() => senInMalayWords(10.5)).toThrow(RangeError);
  });
});

describe("receipt share links", () => {
  const secret = "a".repeat(40);
  const id = "3f1c2b4a-1111-4222-8333-444455556666";
  const now = new Date("2026-11-28T00:00:00Z");

  it("reads back a fresh link", () => {
    const token = makeReceiptToken(secret, id, now);
    expect(readReceiptToken(secret, token, now)).toEqual({ ok: true, id });
  });

  it("works for 30 days, then expires", () => {
    const token = makeReceiptToken(secret, id, now);
    const day29 = new Date(now.getTime() + 29 * 86_400_000);
    const day31 = new Date(now.getTime() + 31 * 86_400_000);
    expect(readReceiptToken(secret, token, day29).ok).toBe(true);
    expect(readReceiptToken(secret, token, day31)).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses a changed id, expiry or signature", () => {
    const token = makeReceiptToken(secret, id, now);
    const [, expires, sig] = token.split(".");
    const otherId = "3f1c2b4a-1111-4222-8333-444455556667";
    expect(readReceiptToken(secret, `${otherId}.${expires}.${sig}`, now)).toEqual({ ok: false, reason: "bad" });
    const later = (parseInt(expires, 36) + 86_400 * 365).toString(36);
    expect(readReceiptToken(secret, `${id}.${later}.${sig}`, now)).toEqual({ ok: false, reason: "bad" });
    expect(readReceiptToken(secret, `${id}.${expires}.${sig.slice(0, -1)}x`, now).ok).toBe(false);
  });

  it("refuses a link signed with another secret, and junk", () => {
    const token = makeReceiptToken("b".repeat(40), id, now);
    expect(readReceiptToken(secret, token, now).ok).toBe(false);
    expect(readReceiptToken(secret, "", now).ok).toBe(false);
    expect(readReceiptToken(secret, "x.y.z", now).ok).toBe(false);
    expect(readReceiptToken(secret, `${id}..`, now).ok).toBe(false);
  });

  it("will not sign with a short secret", () => {
    expect(() => makeReceiptToken("short", id, now)).toThrow();
    expect(readReceiptToken("short", makeReceiptToken(secret, id, now), now).ok).toBe(false);
  });
});

describe("receipt PDF", () => {
  const labels: ReceiptLabels = {
    title: "E-resit sumbangan",
    number: "No. resit",
    date: "Tarikh",
    from: "Daripada",
    fund: "Dana",
    method: "Kaedah",
    total: "Jumlah",
    inWords: "Ringgit Malaysia:",
    thanks: "Terima kasih.",
    signature: "Tandatangan Bendahari",
    credit: "Dijana oleh Imarah",
    cancelled: "BATAL",
    cancelledNote: "Resit ini telah dibatalkan.",
    qr: "Derma melalui DuitNow",
  };
  const data: ReceiptData = {
    masjidName: "Masjid Al-Hidayah",
    area: "Taman Seri Murni",
    initials: "MA",
    logo: null,
    receiptNo: "RC-2026-0001",
    date: "29 Okt 2026",
    receivedFrom: "Penderma contoh",
    fund: "Tabung Am",
    method: "Tunai",
    amountSen: 10000,
    cancelled: false,
    showCredit: true,
    qr: null,
  };

  it("makes a PDF with initials", async () => {
    const pdf = await renderReceiptPdf(data, labels);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
  }, 30_000);

  it("makes a PDF with a logo, cancelled and without the credit", async () => {
    const logo = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 15, g: 118, b: 110, alpha: 1 } } })
      .png()
      .toBuffer();
    const pdf = await renderReceiptPdf({ ...data, logo, cancelled: true, showCredit: false, receivedFrom: null }, labels);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.includes(Buffer.from("/Image"))).toBe(true);
  }, 30_000);

  it("makes a PDF with the DuitNow QR", async () => {
    const plain = await renderReceiptPdf(data, labels);
    const withQr = await renderReceiptPdf({ ...data, qr: qrShape("00020101021126300014A000000615000101060000005204000053034585802MY5909MASJID AA6005KAJANG6304ABCD") }, labels);
    expect(withQr.subarray(0, 5).toString()).toBe("%PDF-");
    expect(withQr.length).toBeGreaterThan(plain.length + 1000);
  }, 30_000);
});
