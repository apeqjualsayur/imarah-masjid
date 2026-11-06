import { describe, expect, it } from "vitest";
import { formatSen } from "@/lib/money";

describe("formatSen", () => {
  it("formats sen as ringgit with two decimals", () => {
    expect(formatSen(123450)).toBe("RM 1,234.50");
  });

  it("keeps a leading zero in the sen", () => {
    expect(formatSen(105)).toBe("RM 1.05");
    expect(formatSen(5)).toBe("RM 0.05");
  });

  it("formats zero", () => {
    expect(formatSen(0)).toBe("RM 0.00");
    expect(formatSen(-0)).toBe("RM 0.00");
  });

  it("does not add a comma below one thousand", () => {
    expect(formatSen(99999)).toBe("RM 999.99");
  });

  it("groups large amounts in thousands", () => {
    expect(formatSen(100000)).toBe("RM 1,000.00");
    expect(formatSen(123456789012)).toBe("RM 1,234,567,890.12");
  });

  it("puts the minus sign before RM", () => {
    expect(formatSen(-128460)).toBe("-RM 1,284.60");
  });

  it("is exact at the largest safe integer", () => {
    expect(formatSen(Number.MAX_SAFE_INTEGER)).toBe("RM 90,071,992,547,409.91");
  });

  it("rejects anything that is not integer sen", () => {
    expect(() => formatSen(12.5)).toThrow(RangeError);
    expect(() => formatSen(Number.NaN)).toThrow(RangeError);
    expect(() => formatSen(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => formatSen(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});
