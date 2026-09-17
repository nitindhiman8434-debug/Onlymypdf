import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/** Shown on buttons during conversion — no time estimates or "large file" hints. */
const FORBIDDEN_PROCESSING_LABEL_PATTERNS = [
  /large files may take/i,
  /may take a few/i,
  /may take \d/i,
  /\(\s*large files/i,
  /\d+[–-]\d+\s*min/i,
];

const SCAN_ROOTS = [
  "src/app/(tools)",
  "src/components/tools",
];

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

describe("tool processing labels", () => {
  it("does not show time-estimate hints on any tool UI", () => {
    const projectRoot = path.resolve(__dirname, "../../..");
    const offenders: string[] = [];

    for (const relRoot of SCAN_ROOTS) {
      const absRoot = path.join(projectRoot, relRoot);
      if (!fs.existsSync(absRoot)) continue;

      for (const file of collectSourceFiles(absRoot)) {
        const content = fs.readFileSync(file, "utf8");
        const relFile = path.relative(projectRoot, file).replace(/\\/g, "/");

        for (const pattern of FORBIDDEN_PROCESSING_LABEL_PATTERNS) {
          if (pattern.test(content)) {
            offenders.push(`${relFile} matches ${pattern}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
