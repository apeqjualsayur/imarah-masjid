// Ten known entries across three funds, then one reversal. The expected
// figures below were worked out by hand (and checked with a calculator), not
// by the code under test. Used by the unit test and by the database test.

export type FundKey = "am" | "pembangunan" | "jariah";

export type KnownEntry = {
  n: number;
  date: string;
  fund: FundKey;
  direction: "in" | "out";
  category: string;
  amount: string;
  sen: number;
};

export const FUND_NAMES: Record<FundKey, string> = {
  am: "Tabung Am",
  pembangunan: "Pembangunan",
  jariah: "Amal Jariah",
};

export const TEN_ENTRIES: KnownEntry[] = [
  { n: 1, date: "2026-10-02", fund: "am", direction: "in", category: "Kutipan Jumaat", amount: "1,250.50", sen: 125_050 },
  { n: 2, date: "2026-10-09", fund: "am", direction: "in", category: "Kutipan Jumaat", amount: "980", sen: 98_000 },
  { n: 3, date: "2026-10-12", fund: "am", direction: "out", category: "Bil elektrik/air", amount: "345.60", sen: 34_560 },
  { n: 4, date: "2026-10-20", fund: "pembangunan", direction: "in", category: "Derma", amount: "5000.00", sen: 500_000 },
  { n: 5, date: "2026-10-28", fund: "pembangunan", direction: "out", category: "Penyelenggaraan", amount: "1,200", sen: 120_000 },
  { n: 6, date: "2026-11-03", fund: "jariah", direction: "in", category: "Derma", amount: "300.00", sen: 30_000 },
  { n: 7, date: "2026-11-06", fund: "am", direction: "in", category: "Kutipan Jumaat", amount: "RM 1,105.25", sen: 110_525 },
  { n: 8, date: "2026-11-10", fund: "am", direction: "out", category: "Gaji", amount: "800", sen: 80_000 },
  { n: 9, date: "2026-11-14", fund: "jariah", direction: "out", category: "Kebajikan", amount: "150.00", sen: 15_000 },
  { n: 10, date: "2026-11-18", fund: "pembangunan", direction: "in", category: "Sewaan dewan", amount: "250.00", sen: 25_000 },
];

/** Entry 8 (Gaji RM 800.00) was wrong and is cancelled on 20 Nov. */
export const REVERSED = 8;
export const REVERSAL_DATE = "2026-11-20";

// By hand:
// Tabung Am:    1,250.50 + 980.00 - 345.60 + 1,105.25 - 800.00 + 800.00 = 2,990.15
// Pembangunan:  5,000.00 - 1,200.00 + 250.00                             = 4,050.00
// Amal Jariah:    300.00 - 150.00                                        =   150.00
// All funds:    2,990.15 + 4,050.00 + 150.00                             = 7,190.15
export const EXPECTED_BALANCES: Record<FundKey, number> = {
  am: 299_015,
  pembangunan: 405_000,
  jariah: 15_000,
};
export const EXPECTED_TOTAL = 719_015;

// October:  in 1,250.50 + 980.00 + 5,000.00 = 7,230.50;  out 345.60 + 1,200.00 = 1,545.60
// November: in 300.00 + 1,105.25 + 250.00   = 1,655.25;  out 800.00 + 150.00 - 800.00 (cancelled) = 150.00
export const EXPECTED_MONTHS = {
  "2026-10": { in_sen: 723_050, out_sen: 154_560 },
  "2026-11": { in_sen: 165_525, out_sen: 15_000 },
};

// Tabung Am in November: opening 1,250.50 + 980.00 - 345.60 = 1,884.90,
// in 1,105.25, out 0.00 (the Gaji and its cancellation), closing 2,990.15.
export const EXPECTED_AM_NOVEMBER = { opening_sen: 188_490, in_sen: 110_525, out_sen: 0, closing_sen: 299_015 };
