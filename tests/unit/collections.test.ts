import { describe, expect, it } from "vitest";
import {
  breakdownTotal,
  cleanBreakdown,
  collectionError,
  dequeue,
  enqueue,
  isNetworkFailure,
  parseCount,
  queueName,
  readQueue,
  type QueuedCount,
} from "@/lib/collections";

describe("note breakdown", () => {
  it("adds notes and coins in sen", () => {
    // 3 x RM100 + 7 x RM50 + 12 x RM10 + 9 x RM1 + RM4.50 in coins = RM 783.50
    expect(breakdownTotal({ "100": 3, "50": 7, "10": 12, "1": 9, coins_sen: 450 })).toBe(78_350);
  });

  it("is zero when empty", () => {
    expect(breakdownTotal({})).toBe(0);
  });

  it("keeps only notes that were counted", () => {
    expect(cleanBreakdown({ "100": 0, "50": 2, coins_sen: 0 })).toEqual({ "50": 2 });
    expect(cleanBreakdown({ "100": 0 })).toBeNull();
  });

  it("reads note counts typed by hand", () => {
    expect(parseCount("")).toBe(0);
    expect(parseCount(" 12 ")).toBe(12);
    expect(parseCount("1.5")).toBeNull();
    expect(parseCount("-2")).toBeNull();
    expect(parseCount("abc")).toBeNull();
  });
});

describe("refusals become plain messages", () => {
  it.each([
    ["collection: you cannot confirm your own count", "own_count"],
    ["collections: the counter cannot check their own count", "own_count"],
    ["collection: recount first", "needs_recount"],
    ["collection: the breakdown does not add up to the amount", "breakdown_mismatch"],
    ["collection: this count was cancelled", "collection_closed"],
    ["collection: a confirmed or cancelled count cannot be changed", "collection_closed"],
    ["locked period: 2026-09-15 is in a locked month", "locked_month"],
    ["collection: choose an open fund", "fund_archived"],
    ["collection: the date is in the future", "date_future"],
  ])("%s", (message, key) => {
    expect(collectionError({ message })).toBe(key);
  });
});

describe("offline queue", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
      data,
    };
  };
  const item = (key: string, total_sen = 1_000): QueuedCount => ({
    key,
    date: "2026-11-20",
    fund_id: "f",
    fund_name: "Tabung Am",
    total_sen,
    breakdown: null,
    note: "",
    saved_at: "2026-11-20T05:00:00Z",
  });

  it("keeps counts until they are sent", () => {
    const store = memory();
    enqueue(store, "u1", item("a"));
    enqueue(store, "u1", item("b"));
    expect(readQueue(store, "u1").map((entry) => entry.key)).toEqual(["a", "b"]);
    expect(dequeue(store, "u1", "a").map((entry) => entry.key)).toEqual(["b"]);
    dequeue(store, "u1", "b");
    expect(store.data.has(queueName("u1"))).toBe(false);
  });

  it("the same count queued twice is kept once", () => {
    const store = memory();
    enqueue(store, "u1", item("a", 1_000));
    enqueue(store, "u1", item("a", 1_000));
    expect(readQueue(store, "u1")).toHaveLength(1);
  });

  it("each person on a shared phone has their own queue", () => {
    const store = memory();
    enqueue(store, "u1", item("a"));
    expect(readQueue(store, "u2")).toEqual([]);
  });

  it("copes with damaged or blocked storage", () => {
    const store = memory();
    store.setItem(queueName("u1"), "{not json");
    expect(readQueue(store, "u1")).toEqual([]);
    expect(readQueue(null, "u1")).toEqual([]);
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    };
    expect(enqueue(blocked, "u1", item("a"))).toEqual([]);
  });

  it("tells a lost connection from a refusal", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFailure(new Error("NetworkError when attempting to fetch resource"))).toBe(true);
    expect(isNetworkFailure(new Error("something else"))).toBe(false);
  });
});
