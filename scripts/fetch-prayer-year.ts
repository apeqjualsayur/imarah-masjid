// Builds the bundled prayer-time fallback for every JAKIM zone:
//   npm run prayer:fetch-year -- 2027
// Writes data/prayer-times/<year>.json. Re-run when JAKIM publishes a new year.
// Months not published yet are left out and reported; checks are the same as
// for live data, so nothing doubtful goes into the file.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PRAYER_ZONES } from "../lib/malaysia";
import { fallbackPath, fetchApiMonth, type YearFile } from "../lib/prayer-times";

const plainFetch = (url: string) => fetch(url, { signal: AbortSignal.timeout(15_000) });

async function main() {
  const year = Number(process.argv[2]);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    console.error("Usage: npm run prayer:fetch-year -- 2027");
    process.exit(2);
  }

  const zones = [...new Set(Object.values(PRAYER_ZONES).flat().map((zone) => zone.code))].sort();
  const file: YearFile = { year, zones: {} };
  const missing: string[] = [];

  for (const zone of zones) {
    const months: number[][][] = [];
    for (let month = 1; month <= 12; month += 1) {
      try {
        const days = await fetchApiMonth(zone, year, month, plainFetch);
        months.push(days.map((day) => day.minutes));
      } catch (error) {
        missing.push(`${zone} ${year}-${month} (${(error as Error).message})`);
        break;
      }
    }
    // Only whole years go in: a zone with a gap would give some months and not others.
    if (months.length === 12) file.zones[zone] = months;
    process.stdout.write(`${zone}: ${months.length}/12\n`);
  }

  const count = Object.keys(file.zones).length;
  if (count === 0) {
    console.error(`No zone has all of ${year} yet. Nothing written.`);
    process.exit(1);
  }

  const out = fallbackPath(year);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(file)}\n`);
  console.log(`Wrote ${out}: ${count}/${zones.length} zones`);
  if (missing.length) {
    console.warn(`Missing:\n  ${missing.join("\n  ")}`);
    process.exit(3);
  }
}

main();
