#!/usr/bin/env tsx

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import {
  deletePdfBlobObjects,
  getPdfBlobObjectInfo,
  listR2PdfBlobObjects,
  putPdfBlobObject,
} from "../src/lib/server/pdf-blob-storage";
import { cleanupExpiredConversionJobs } from "../src/lib/services/cleanup.service";

loadEnvConfig(process.cwd());

const reportPath = path.resolve(
  "quality",
  "phase1-corpus",
  "retention-retry-report.json"
);

async function main() {
  const markerPath = `temp-jobs/pdf-to-word/retention-drill/${crypto.randomUUID()}.pdf`;
  const marker = Buffer.from("%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
  let markerPresent = false;

  try {
    await putPdfBlobObject(markerPath, marker, "application/pdf");
    markerPresent = true;
    const stored = await getPdfBlobObjectInfo(markerPath);
    if (stored.size !== marker.length) {
      throw new Error(`Retention marker stored ${stored.size} bytes; expected ${marker.length}.`);
    }

    const simulatedFailure = await cleanupExpiredConversionJobs({
      nowMs: Date.now() + 1_000,
      ttlMs: 0,
      deleteObjects: async () => {
        throw new Error("CONTROLLED_PHASE1_DELETE_FAILURE");
      },
    });
    if (simulatedFailure.failed !== 1 || simulatedFailure.deleted !== 0) {
      throw new Error(`Controlled deletion failure was not recorded: ${JSON.stringify(simulatedFailure)}`);
    }
    await getPdfBlobObjectInfo(markerPath);

    const retry = await cleanupExpiredConversionJobs({
      nowMs: Date.now() + 1_000,
      ttlMs: 0,
    });
    if (retry.deleted !== 1 || retry.failed !== 0) {
      throw new Error(`Deletion retry did not succeed: ${JSON.stringify(retry)}`);
    }
    markerPresent = false;
    const remaining = await listR2PdfBlobObjects(markerPath);
    if (remaining.length !== 0) {
      throw new Error("Retention marker remained in R2 after the successful retry.");
    }

    const report = {
      generatedAt: new Date().toISOString(),
      storageProvider: "r2",
      markerPath,
      markerBytes: marker.length,
      configuredRetentionHours: 2,
      drillTtlMs: 0,
      controlledFailure: simulatedFailure,
      retry,
      markerRemainingAfterRetry: remaining.length,
      result: "pass",
      scope:
        "Live R2 failure accounting and retry deletion. The production worker keeps the two-hour TTL and runs the same cleanup hourly.",
    };
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (markerPresent) {
      await deletePdfBlobObjects([markerPath]).catch(() => undefined);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
