import { describe, expect, it } from "vitest";
import { usdToCents } from "../../src/lib/client/money";

describe("UI money boundary adapter", () => {
  it("converts dollar strings to exact integer cents and preserves zero", () => {
    expect(usdToCents("")).toBeNull();
    expect(usdToCents("0")).toBe(0);
    expect(usdToCents("12.3")).toBe(1230);
    expect(usdToCents("12.34")).toBe(1234);
    expect(usdToCents("9999999999.99")).toBe(999999999999);
  });

  it("rejects precision and ranges the JSON cents contract cannot represent", () => {
    expect(() => usdToCents("1.234")).toThrow();
    expect(() => usdToCents("-1.00")).toThrow();
    expect(() => usdToCents("10000000000.00")).toThrow();
  });
});
