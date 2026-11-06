import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ms from "@/messages/ms.json";

function keysOf(value: object, prefix = ""): string[] {
  return Object.entries(value)
    .flatMap(([key, child]) =>
      typeof child === "object" && child !== null
        ? keysOf(child, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    )
    .sort();
}

describe("messages", () => {
  it("has the same keys in Bahasa Malaysia and English", () => {
    expect(keysOf(en)).toEqual(keysOf(ms));
  });
});
