import fs from "node:fs/promises";
import path from "node:path";
import { validateSingleUpload } from "../src/lib/server/upload-validation";

const MB = 1024 * 1024;
const cases = [
  { label: "free-exact", sizeMB: 25, limitMB: 25, expected: true },
  { label: "free-over", sizeMB: 25 + 1 / MB, limitMB: 25, expected: false },
  { label: "pro-50", sizeMB: 50, limitMB: 200, expected: true },
  { label: "pro-100", sizeMB: 100, limitMB: 200, expected: true },
  { label: "pro-exact", sizeMB: 200, limitMB: 200, expected: true },
  { label: "pro-over", sizeMB: 200 + 1 / MB, limitMB: 200, expected: false },
];

function fileFor(sizeBytes: number): File {
  return {
    name: "boundary.pdf",
    type: "application/pdf",
    size: sizeBytes,
    arrayBuffer: async () => {
      const bytes = new Uint8Array(sizeBytes);
      bytes.set(new TextEncoder().encode("%PDF-1.7\n"));
      bytes.set(new TextEncoder().encode("%%EOF"), sizeBytes - 5);
      return bytes.buffer;
    },
  } as File;
}

async function main() {
  const results = [];
  for (const test of cases) {
    const sizeBytes = Math.round(test.sizeMB * MB);
    const began = Date.now();
    const checked = await validateSingleUpload(fileFor(sizeBytes), ["pdf"], test.limitMB);
    const passed = checked.ok === test.expected;
    results.push({
      ...test,
      sizeBytes,
      accepted: checked.ok,
      passed,
      durationMs: Date.now() - began,
      error: checked.ok ? null : checked.error,
    });
  }

  const concurrentStarted = Date.now();
  const concurrentSizesMB = [25, 50, 100, 200];
  const concurrent = await Promise.all(
    concurrentSizesMB.map(async (sizeMB) => {
      const checked = await validateSingleUpload(fileFor(sizeMB * MB), ["pdf"], 200);
      return { sizeMB, accepted: checked.ok };
    })
  );

  const report = {
    generatedAt: new Date().toISOString(),
    cases: results.length,
    passed: results.filter((entry) => entry.passed).length,
    failed: results.filter((entry) => !entry.passed).length,
    allPassed: results.every((entry) => entry.passed),
    concurrentBatch: {
      jobs: concurrent.length,
      sizesMB: concurrentSizesMB,
      durationMs: Date.now() - concurrentStarted,
      allAccepted: concurrent.every((entry) => entry.accepted),
      results: concurrent,
    },
    evidenceScope:
      "Application upload validation at exact 25 MB and 200 MB limits. CDN/proxy and production worker limits require deployed-environment verification.",
    results,
  };
  const target = path.resolve(process.cwd(), "quality", "phase1-corpus", "upload-boundary-report.json");
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.allPassed || !report.concurrentBatch.allAccepted) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
