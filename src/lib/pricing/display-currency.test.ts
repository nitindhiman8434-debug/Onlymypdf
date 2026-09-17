import { describe, expect, it } from "vitest";
import {
  convertInrForDisplay,
  formatDisplayAmount,
  isDisplayCurrency,
} from "./display-currency";

describe("display-currency", () => {
  it("keeps INR amounts unchanged", () => {
    expect(convertInrForDisplay(299, "INR")).toBe(299);
    expect(formatDisplayAmount(299, "INR")).toMatch(/299/);
  });

  it("uses marketing USD and EUR prices for Pro plans", () => {
    expect(convertInrForDisplay(299, "USD")).toBe(4);
    expect(convertInrForDisplay(2399, "USD")).toBe(32);
    expect(formatDisplayAmount(299, "USD")).toBe("$4.00");
    expect(convertInrForDisplay(299, "EUR")).toBe(4);
    expect(formatDisplayAmount(299, "EUR")).toMatch(/4,00|4\.00/);
  });

  it("falls back to rate conversion for unknown INR amounts", () => {
    expect(convertInrForDisplay(1000, "EUR")).toBeCloseTo(11.11, 1);
  });

  it("validates currency codes", () => {
    expect(isDisplayCurrency("USD")).toBe(true);
    expect(isDisplayCurrency("GBP")).toBe(false);
  });
});
