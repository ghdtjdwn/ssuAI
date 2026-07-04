import { describe, expect, it } from "vitest";

import { formatCount, formatFixed } from "@/lib/utils";

describe("formatFixed", () => {
  it("formats a finite number to fixed digits", () => {
    expect(formatFixed(3.456)).toBe("3.46");
    expect(formatFixed(4, 1)).toBe("4.0");
  });

  it("renders a dash for null/undefined/NaN instead of throwing", () => {
    // The saint wire type says gpa is non-null, but u-SAINT can omit it
    // (P/F-only term). A raw .toFixed() on null throws and blanks the page.
    expect(formatFixed(null)).toBe("—");
    expect(formatFixed(undefined)).toBe("—");
    expect(formatFixed(Number.NaN)).toBe("—");
    expect(formatFixed(null, 2, "-")).toBe("-");
  });
});

describe("formatCount", () => {
  it("formats a finite number with thousands separators", () => {
    expect(formatCount(1234567)).toBe("1,234,567");
  });

  it("renders a dash for null/undefined instead of throwing", () => {
    expect(formatCount(null)).toBe("—");
    expect(formatCount(undefined)).toBe("—");
  });
});
