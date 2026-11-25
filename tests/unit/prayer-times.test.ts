import { describe, expect, it } from "vitest";
import {
  formatMinutes,
  isValidDay,
  isValidMonth,
  malaysiaNow,
  pickHighlight,
  type PrayerDay,
} from "@/lib/prayer-schedule";
import { fallbackMonth, getPrayerDays, parseApiMonth, type YearFile } from "@/lib/prayer-times";

// 25 Nov 2026, SGR01 (from JAKIM via api.waktusolat.app).
const SGR01_25_NOV = [350, 420, 783, 985, 1140, 1214];
const at = (iso: string) => new Date(iso).getTime();

function month(year: number, m: number, minutes = SGR01_25_NOV): PrayerDay[] {
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => ({
    date: `${year}-${`${m}`.padStart(2, "0")}-${`${i + 1}`.padStart(2, "0")}`,
    minutes,
  }));
}

/** A fake api.waktusolat.app month: epoch seconds, as the real feed sends. */
function apiMonth(zone: string, year: number, m: number) {
  return {
    zone,
    prayers: month(year, m).map((day, i) => {
      const midnight = Date.UTC(year, m - 1, i + 1) / 1000 - 8 * 3600;
      const [fajr, syuruk, dhuhr, asr, maghrib, isha] = day.minutes.map((v) => midnight + v * 60);
      return { day: i + 1, hijri: "", imsak: fajr - 600, fajr, syuruk, dhuha: syuruk + 900, dhuhr, asr, maghrib, isha };
    }),
  };
}

const okFetch = (zone: string) => async (url: string) => {
  const [, y, m] = /year=(\d+)&month=(\d+)/.exec(url)!;
  return new Response(JSON.stringify(apiMonth(zone, Number(y), Number(m))));
};
const downFetch = async () => {
  throw new Error("network blocked");
};
const yearFile = (zone: string): YearFile => ({
  year: 2026,
  zones: { [zone]: Array.from({ length: 12 }, (_, i) => month(2026, i + 1, [351, 421, 784, 986, 1141, 1215]).map((d) => d.minutes)) },
});

describe("Malaysian time", () => {
  it("is UTC+8", () => {
    expect(malaysiaNow(at("2026-11-25T16:30:00Z"))).toMatchObject({ date: "2026-11-26", minute: 30 });
  });

  it("writes times like the designs", () => {
    expect(formatMinutes(350)).toBe("5:50");
    expect(formatMinutes(783)).toBe("1:03");
    expect(formatMinutes(720)).toBe("12:00");
  });
});

describe("data checks", () => {
  it("accepts a proper day", () => {
    expect(isValidDay({ date: "2026-11-25", minutes: SGR01_25_NOV }, "2026-11-25")).toBe(true);
  });

  it.each([
    ["times out of order", [350, 420, 783, 700, 1140, 1214]],
    ["a missing time", [350, 420, 783, 985, 1140]],
    ["a time past midnight", [350, 420, 783, 985, 1140, 1440]],
    ["a fraction", [350.5, 420, 783, 985, 1140, 1214]],
  ])("rejects %s", (_, minutes) => {
    expect(isValidDay({ date: "2026-11-25", minutes }, "2026-11-25")).toBe(false);
  });

  it("rejects the wrong date", () => {
    expect(isValidDay({ date: "2026-11-24", minutes: SGR01_25_NOV }, "2026-11-25")).toBe(false);
  });

  it("rejects a month with a day missing", () => {
    expect(isValidMonth(month(2026, 11).slice(1), 2026, 11)).toBe(false);
    expect(isValidMonth(month(2026, 11), 2026, 11)).toBe(true);
  });
});

describe("reading the feed", () => {
  it("turns epoch seconds into Malaysian minutes", () => {
    const days = parseApiMonth(apiMonth("SGR01", 2026, 11), "SGR01", 2026, 11);
    expect(days[24]).toEqual({ date: "2026-11-25", minutes: SGR01_25_NOV });
  });

  it("refuses another zone's data", () => {
    expect(() => parseApiMonth(apiMonth("JHR01", 2026, 11), "SGR01", 2026, 11)).toThrow();
  });

  it("refuses a month with a day missing", () => {
    const raw = apiMonth("SGR01", 2026, 11);
    raw.prayers.pop();
    expect(() => parseApiMonth(raw, "SGR01", 2026, 11)).toThrow();
  });

  it("refuses times in milliseconds or text", () => {
    const raw = apiMonth("SGR01", 2026, 11) as { prayers: Record<string, unknown>[] };
    raw.prayers[0].fajr = "5:50";
    expect(() => parseApiMonth(raw, "SGR01", 2026, 11)).toThrow();
  });
});

describe("where times come from", () => {
  const now = at("2026-11-25T05:00:00Z"); // 1:00 pm in Malaysia

  it("uses the feed first", async () => {
    const result = await getPrayerDays("SGR01", now, { fetcher: okFetch("SGR01"), readYear: async () => null });
    expect(result?.source).toBe("api");
    expect(result?.days.map((d) => d.date)).toEqual(["2026-11-25", "2026-11-26"]);
  });

  it("falls back to the bundled file when the feed is down", async () => {
    const result = await getPrayerDays("SGR01", now, { fetcher: downFetch, readYear: async () => yearFile("SGR01") });
    expect(result?.source).toBe("fallback");
    expect(result?.days[0].minutes[0]).toBe(351);
  });

  it("falls back when the feed sends bad data", async () => {
    const bad = async () => new Response(JSON.stringify({ zone: "SGR01", prayers: [] }));
    const result = await getPrayerDays("SGR01", now, { fetcher: bad, readYear: async () => yearFile("SGR01") });
    expect(result?.source).toBe("fallback");
  });

  it("gives nothing, never guesses, when both are missing", async () => {
    expect(await getPrayerDays("SGR01", now, { fetcher: downFetch, readYear: async () => null })).toBeNull();
  });

  it("gives nothing for a zone the bundled file does not have", async () => {
    expect(await getPrayerDays("SGR01", now, { fetcher: downFetch, readYear: async () => yearFile("JHR01") })).toBeNull();
  });

  it("gives nothing without a zone", async () => {
    expect(await getPrayerDays(null, now)).toBeNull();
    expect(await getPrayerDays("sgr01; drop", now)).toBeNull();
  });

  it("fetches next month too on the last day", async () => {
    const lastDay = at("2026-11-30T05:00:00Z");
    const result = await getPrayerDays("SGR01", lastDay, { fetcher: okFetch("SGR01"), readYear: async () => null });
    expect(result?.days.map((d) => d.date)).toEqual(["2026-11-30", "2026-12-01"]);
  });

  it("the real bundled file has every zone for 2026", async () => {
    const days = await fallbackMonth("SGR01", 2026, 11);
    expect(days?.[24]).toEqual({ date: "2026-11-25", minutes: SGR01_25_NOV });
    expect(await fallbackMonth("PNG01", 2026, 11)).not.toBeNull();
  });
});

describe("the next prayer", () => {
  const days: PrayerDay[] = [
    { date: "2026-11-25", minutes: SGR01_25_NOV },
    { date: "2026-11-26", minutes: [351, 421, 783, 985, 1140, 1214] },
  ];
  const myt = (time: string) => at(`2026-11-25T${time}:00+08:00`);

  it.each([
    ["04:00", "subuh"],
    ["06:00", "zohor"], // Syuruk is skipped: it is not a prayer.
    ["13:02", "zohor"],
    ["13:03", "asar"],
    ["17:00", "maghrib"],
    ["19:30", "isyak"],
  ])("at %s it is %s", (time, next) => {
    expect(pickHighlight(days, myt(time))).toMatchObject({ day: days[0], next });
  });

  it("after Isyak it shows tomorrow with Subuh next", () => {
    expect(pickHighlight(days, myt("21:00"))).toEqual({ day: days[1], next: "subuh" });
  });

  it("after midnight tomorrow becomes today", () => {
    expect(pickHighlight(days, at("2026-11-26T01:00:00+08:00"))).toEqual({ day: days[1], next: "subuh" });
  });

  it("hides when the data is for another day", () => {
    expect(pickHighlight(days, at("2026-11-28T09:00:00+08:00"))).toBeNull();
  });
});
