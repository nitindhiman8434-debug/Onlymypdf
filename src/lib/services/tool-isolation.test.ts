import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Guardrail: hybrid/scanned routing is pdf-to-word only.
 * Other conversion tools must not import engine-plan or hybrid hints.
 */
const SERVICES_DIR = path.join(process.cwd(), "src/lib/services");

const ISOLATED_FROM_HYBRID = [
  "pdf-compress.service.ts",
  "pdf-merge.service.ts",
  "pdf-split.service.ts",
  "pdf-rotate.service.ts",
  "pdf-to-excel.service.ts",
  "pdf-to-ppt.service.ts",
  "pdf-convert.service.ts",
  "word-to-pdf.service.ts",
  "html-to-pdf-convert.service.ts",
];

const FORBIDDEN_IMPORTS = [
  "isHybridScannedPdf",
  "resolveConversionStrategy",
  "resolvePdfHintsSafe",
  "estimatePdfHintsFromPath",
];

describe("pdf-to-word hybrid routing isolation", () => {
  for (const file of ISOLATED_FROM_HYBRID) {
    it(`${file} does not import hybrid routing`, () => {
      const content = fs.readFileSync(path.join(SERVICES_DIR, file), "utf8");
      for (const symbol of FORBIDDEN_IMPORTS) {
        expect(content.includes(symbol)).toBe(false);
      }
    });
  }
});
