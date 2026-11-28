// Amounts in Malay words for receipts: "Seratus dua puluh ringgit dan lima
// puluh sen sahaja". Works on integer sen only, like everything else with money.

const ONES = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "lapan", "sembilan"];

/** 1..999 in words. */
function belowThousand(n: number): string {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  if (hundreds === 1) words.push("seratus");
  else if (hundreds > 1) words.push(`${ONES[hundreds]} ratus`);

  if (rest === 10) words.push("sepuluh");
  else if (rest === 11) words.push("sebelas");
  else if (rest > 11 && rest < 20) words.push(`${ONES[rest - 10]} belas`);
  else if (rest >= 20) {
    words.push(`${ONES[Math.floor(rest / 10)]} puluh`);
    if (rest % 10) words.push(ONES[rest % 10]);
  } else if (rest > 0) words.push(ONES[rest]);

  return words.join(" ");
}

const SCALES: [number, string, string][] = [
  [1_000_000_000, "bilion", "sebilion"],
  [1_000_000, "juta", "sejuta"],
  [1_000, "ribu", "seribu"],
];

/** A whole number in Malay words: 0 -> "kosong", 1000 -> "seribu", 2500 -> "dua ribu lima ratus". */
export function numberInMalay(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`numberInMalay expects a whole number, received ${n}`);
  if (n === 0) return "kosong";

  const words: string[] = [];
  let rest = n;
  for (const [size, name, single] of SCALES) {
    const count = Math.floor(rest / size);
    if (count === 0) continue;
    words.push(count === 1 ? single : `${numberInMalay(count)} ${name}`);
    rest %= size;
  }
  if (rest > 0) words.push(belowThousand(rest));
  return words.join(" ");
}

/**
 * Integer sen in words, capitalised, ending in "sahaja" as on Malaysian
 * receipts and cheques. 12050 -> "Seratus dua puluh ringgit dan lima puluh sen sahaja".
 */
export function senInMalayWords(sen: number): string {
  if (!Number.isSafeInteger(sen) || sen <= 0) throw new RangeError(`senInMalayWords expects positive integer sen, received ${sen}`);

  const ringgit = Math.floor(sen / 100);
  const cents = sen % 100;
  const parts: string[] = [];
  if (ringgit > 0) parts.push(`${numberInMalay(ringgit)} ringgit`);
  if (cents > 0) parts.push(`${numberInMalay(cents)} sen`);

  const text = `${parts.join(" dan ")} sahaja`;
  return text[0].toUpperCase() + text.slice(1);
}
