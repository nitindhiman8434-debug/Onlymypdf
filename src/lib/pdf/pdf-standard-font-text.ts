import type { PDFFont } from "pdf-lib";

/** Common Unicode symbols that WinAnsi standard fonts cannot encode. */
const UNICODE_FALLBACKS: Record<string, string> = {
  "\u20b9": "Rs.", // ₹
  "\u2192": "->", // →
  "\u2190": "<-", // ←
  "\u2191": "^", // ↑
  "\u2193": "v", // ↓
  "\u2026": "...", // …
  "\u2713": "v", // ✓
  "\u2714": "v", // ✔
  "\u2717": "x", // ✗
  "\u2718": "x", // ✘
  "\u2265": ">=", // ≥
  "\u2264": "<=", // ≤
  "\u2260": "!=", // ≠
  "\u2248": "~", // ≈
  "\u221e": "inf", // ∞
  "\u00b1": "+/-", // ±
  "\u00d7": "x", // ×
  "\u00f7": "/", // ÷
  "\u00b0": " deg", // °
  "\u2122": "TM", // ™
  "\u00a9": "(c)", // ©
  "\u00ae": "(R)", // ®
  "\u20ac": "EUR", // €
  "\u00a3": "GBP", // £
  "\u00a5": "JPY", // ¥
  "\u00a0": " ", // non-breaking space
};

function canEncode(font: PDFFont, text: string): boolean {
  if (!text) return true;
  try {
    font.encodeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Make plain text safe for pdf-lib StandardFonts (WinAnsi). Replaces unsupported
 * Unicode with readable ASCII fallbacks instead of failing conversion.
 */
export function sanitizeTextForStandardFont(text: string, font: PDFFont): string {
  let normalized = text;
  for (const [char, replacement] of Object.entries(UNICODE_FALLBACKS)) {
    if (normalized.includes(char)) {
      normalized = normalized.split(char).join(replacement);
    }
  }

  const chars = Array.from(normalized);
  const out: string[] = [];

  for (const char of chars) {
    // PDF text is drawn one logical line at a time. Preserve line separators
    // until that split happens; StandardFonts cannot encode them themselves.
    if (char === "\n" || char === "\r") {
      out.push(char);
      continue;
    }
    if (char === "\t") {
      out.push("    ");
      continue;
    }

    if (canEncode(font, char)) {
      out.push(char);
      continue;
    }

    const fallback = UNICODE_FALLBACKS[char] ?? "?";
    if (canEncode(font, fallback)) {
      out.push(fallback);
      continue;
    }

    for (const fbChar of Array.from(fallback)) {
      out.push(canEncode(font, fbChar) ? fbChar : "?");
    }
  }

  return out.join("");
}
