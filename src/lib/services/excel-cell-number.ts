/** A separator is inferred only from unambiguous values or an English column heading. */
export type DecimalSeparator = "." | ",";

function numericParts(value: string) {
  const source = value.trim().replace(/\u2212/g, "-").replace(/[\u00a0\u202f]/g, " ");
  const accounting = source.startsWith("(") && source.endsWith(")");
  let numeric = accounting ? source.slice(1, -1).trim() : source;
  const currency = numeric.match(/^([$€£₹])\s*/)?.[1] ?? numeric.match(/\s*([$€£₹])$/)?.[1];
  if (currency) numeric = numeric.replace(/^[$€£₹]\s*|\s*[$€£₹]$/g, "");
  const percent = numeric.endsWith("%");
  if (percent) numeric = numeric.slice(0, -1).trim();
  if (currency && percent) return null;
  if (accounting && numeric.startsWith("-")) return null;
  if (!/^-?\d[\d., ]*$/.test(numeric)) return null;
  return { numeric, currency, percent, accounting };
}

function decisiveSeparator(value: string): DecimalSeparator | undefined {
  const parts = numericParts(value);
  if (!parts) return;
  const digits = parts.numeric.replace(/^-/, "");
  if (/^\d{1,3}(?:,\d{3})+\.\d+$/.test(digits)) return ".";
  if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(digits)) return ",";
  if (/^\d{1,3}(?:,\d{3}){2,}$/.test(digits)) return ".";
  if (/^\d{1,3}(?:\.\d{3}){2,}$/.test(digits)) return ",";
  const decimal = digits.match(/^(?:\d+|\d{1,3}(?: \d{3})+)([.,])(\d+)$/);
  if (decimal && (decimal[2].length !== 3 || /^0[.,]/.test(digits) || digits.includes(" "))) {
    return decimal[1] as DecimalSeparator;
  }
}

export function inferDecimalSeparators(rows: readonly (readonly unknown[])[]): Array<DecimalSeparator | undefined> {
  const width = rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  const evidence = rows.flatMap((row) => row.map((cell) => decisiveSeparator(String(cell ?? ""))));
  const table = new Set(evidence.filter((value): value is DecimalSeparator => Boolean(value)));
  return Array.from({ length: width }, (_, column) => {
    const values = rows.map((row) => String(row[column] ?? ""));
    const local = new Set(values.map(decisiveSeparator).filter((value): value is DecimalSeparator => Boolean(value)));
    if (local.size === 1) return [...local][0];
    if (local.size > 1 || table.size > 1) return undefined;
    if (table.size === 1) return [...table][0];
    // A currency sign or a single 3-digit separator is not locale evidence.
    // These explicit English numeric headings retain the English table contract.
    if (values.slice(0, 4).some((value) => /^(?:amount|value|unit price|line total|quantity|qty|units|count|rate|revenue)$/i.test(value.trim()))) {
      return ".";
    }
    return undefined;
  });
}

export function parseSemanticNumber(value: string, context?: DecimalSeparator): { value: number; numFmt: string } | null {
  const parts = numericParts(value);
  if (!parts) return null;
  const { currency, percent, accounting } = parts;
  const negative = parts.numeric.startsWith("-") || accounting;
  const unsigned = parts.numeric.replace(/^-/, "");
  const separator = decisiveSeparator(value) ?? context;
  let integer = unsigned;
  let fraction = "";
  if (unsigned.includes(",") || unsigned.includes(".")) {
    if (!separator) return null;
    const grouping = separator === "." ? "," : ".";
    const pieces = unsigned.split(separator);
    if (pieces.length > 2) return null;
    integer = pieces[0];
    fraction = pieces[1] ?? "";
    if (pieces.length === 2 && !/^\d+$/.test(fraction)) return null;
    if (integer.includes(grouping)) {
      const validGrouping = grouping === "," ? /^\d{1,3}(?:,\d{3})+$/ : /^\d{1,3}(?:\.\d{3})+$/;
      if (!validGrouping.test(integer)) return null;
      integer = integer.split(grouping).join("");
    }
  }
  if (integer.includes(" ")) {
    if (!/^\d{1,3}(?: \d{3})+$/.test(integer)) return null;
    integer = integer.replace(/ /g, "");
  }
  if (!/^\d+$/.test(integer)) return null;
  if (integer.length > 1 && integer.startsWith("0")) return null;
  const significantDigits = `${integer}${fraction}`.replace(/^0+/, "").length;
  if (significantDigits > 15 || fraction.length > 15) return null;
  const parsed = Number(`${integer}${fraction ? `.${fraction}` : ""}`);
  const numericValue = (negative ? -parsed : parsed) / (percent ? 100 : 1);
  if (!Number.isFinite(numericValue)) return null;
  const baseFormat = `#,##0${fraction ? `.${"0".repeat(fraction.length)}` : ""}`;
  if (percent) return { value: numericValue, numFmt: `${baseFormat}%` };
  const format = currency ? `"${currency}"${baseFormat}` : baseFormat;
  return { value: numericValue, numFmt: accounting ? `${format};(${format})` : format };
}
