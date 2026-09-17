import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Chrome blocks blob: PDF URLs inside sandboxed iframes.
 * PDF result views must use PdfResultPreview / PdfResultWorkspaceViewer instead.
 */
const FORBIDDEN_PDF_PREVIEW_PATTERNS = [
  /<iframe[\s\S]*?src=\{resultUrl\}/,
  /<iframe[\s\S]*?src=\{blobUrl\}/,
];

const SCAN_ROOTS = ["src/app/(tools)", "src/components/tools"];

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("PDF result preview", () => {
  it("does not embed converted PDFs in sandboxed blob iframes", () => {
    const projectRoot = path.resolve(__dirname, "../../..");
    const offenders: string[] = [];

    for (const relRoot of SCAN_ROOTS) {
      const absRoot = path.join(projectRoot, relRoot);
      if (!fs.existsSync(absRoot)) continue;

      for (const file of collectSourceFiles(absRoot)) {
        const content = fs.readFileSync(file, "utf8");
        for (const pattern of FORBIDDEN_PDF_PREVIEW_PATTERNS) {
          if (pattern.test(content)) {
            offenders.push(path.relative(projectRoot, file));
            break;
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
