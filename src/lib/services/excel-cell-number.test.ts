import { describe, expect, it } from "vitest";
import { inferDecimalSeparators, parseSemanticNumber } from "./excel-cell-number";

describe("Excel numeric cells", () => {
  it.each([
    ["12,50", 12.5], ["1 234,56", 1234.56], ["1\u202f234,56", 1234.56],
    ["1.234,56", 1234.56], ["−12,50", -12.5], ["1.222,06", 1222.06],
    ["1,234.56", 1234.56], ["1,234,567", 1234567], ["1.234.567", 1234567],
    ["$12.50", 12.5], ["12,50 €", 12.5], ["(2.00)", -2], ["(€12,50)", -12.5],
    ["12.5%", 0.125], ["12,5%", 0.125], ["0.125", 0.125], ["0,125", 0.125],
    ["0", 0], ["-12", -12],
  ])("retains the value of %s", (source, expected) => {
    expect(parseSemanticNumber(source as string)?.value).toBeCloseTo(expected as number, 10);
  });

  it.each([
    "001234", "00007", "00123.00", "1234567890123456", "1,234", "1.234",
    "$1,234", "€1.234", "1 23", "12,34.56", "12.34,56", "1,234,56",
    "(-12.5)", "=2+3", "+SUM(A1:A3)", "@SUM(1,2)", "-CMD()", "2026-10-03",
    "12,50%€", "1.2.3", "12 50", "0,001,234", "0.0000000000000001",
  ])("keeps ambiguous, literal or unsafe-to-round input %s as text", (source) => {
    expect(parseSemanticNumber(source)).toBeNull();
  });

  it("uses decimal evidence and English numeric headings for ambiguous groups", () => {
    const english = inferDecimalSeparators([["Year", "Amount"], ["2024", "1,250"]]);
    expect(parseSemanticNumber("1,250", english[1])?.value).toBe(1250);
    expect(inferDecimalSeparators([["Value"], ["1.234,56"], ["1.234"]])).toEqual([","]);
    expect(parseSemanticNumber("1.234", ",")?.value).toBe(1234);
    expect(parseSemanticNumber("1,234", ",")?.value).toBe(1.234);
    expect(parseSemanticNumber("1.234", ".")?.value).toBe(1.234);
  });

  it("does not infer locale from currency, a 3-digit group or conflicting evidence", () => {
    expect(inferDecimalSeparators([["Prix"], ["€1,234"]])).toEqual([undefined]);
    expect(inferDecimalSeparators([["Wert"], ["1.234"]])).toEqual([undefined]);
    const [context] = inferDecimalSeparators([["Amount"], ["12,50"], ["12.50"]]);
    expect(context).toBeUndefined();
    expect(parseSemanticNumber("1,234", context)).toBeNull();
  });

  it("keeps percent and accounting display formats", () => {
    expect(parseSemanticNumber("12,50%")?.numFmt).toBe("#,##0.00%");
    expect(parseSemanticNumber("(2.00)")?.numFmt).toBe("#,##0.00;(#,##0.00)");
    expect(parseSemanticNumber("(€12,50)")?.numFmt).toBe('"€"#,##0.00;("€"#,##0.00)');
  });
});
