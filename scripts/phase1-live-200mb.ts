#!/usr/bin/env tsx

import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { loadEnvConfig } from "@next/env";
import { getConversionWorkerHealth } from "../src/lib/ops/conversion-worker-health";
import {
  createPdfBlobUploadTarget,
  deletePdfBlobObjects,
  getPdfBlobObjectInfo,
} from "../src/lib/server/pdf-blob-storage";
import { validateConversionOutput } from "../src/lib/services/conversion-output-validation";
import {
  consumePdfToWordJob,
  createPdfToWordJob,
  enqueuePdfToWordJob,
  getPdfToWordJob,
  readPdfToWordJobOutput,
  releasePdfToWordJob,
  stagePdfToWordJobInputFromStorage,
  type PdfToWordJob,
} from "../src/lib/services/pdf-to-word-jobs.service";

loadEnvConfig(process.cwd());

const MB = 1024 * 1024;
const TARGET_BYTES = 200 * MB;
const timeoutMs = 15 * 60 * 1000;
const sourceFixture = path.resolve("test-lo-verify", "input.pdf");
const generatedFixture = path.join(os.tmpdir(), "onlymypdf-phase1-exact-200mb.pdf");
const reportPath = path.resolve("quality", "phase1-corpus", "live-200mb-report.json");

async function createExactSizeFixture(): Promise<string> {
  const supplied = process.env.PHASE1_200MB_PDF?.trim();
  if (supplied) {
    const resolved = path.resolve(supplied);
    const stat = await fs.stat(resolved);
    if (stat.size !== TARGET_BYTES) {
      throw new Error(`PHASE1_200MB_PDF must be exactly ${TARGET_BYTES} bytes.`);
    }
    return resolved;
  }

  const source = await fs.readFile(sourceFixture);
  const handle = await fs.open(generatedFixture, "w");
  try {
    await handle.write(source, 0, source.length, 0);
    await handle.truncate(TARGET_BYTES);
  } finally {
    await handle.close();
  }
  return generatedFixture;
}

async function uploadExactFile(uploadUrl: string, fixture: string): Promise<void> {
  const request = {
    method: "PUT",
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(TARGET_BYTES),
    },
    body: Readable.toWeb(createReadStream(fixture)),
    duplex: "half",
  } as unknown as RequestInit;
  const response = await fetch(uploadUrl, request);
  if (!response.ok) {
    throw new Error(`R2 signed upload failed with HTTP ${response.status}.`);
  }
}

async function waitForJob(jobId: string): Promise<PdfToWordJob> {
  const startedAt = Date.now();
  let lastStatus = "queued";
  while (Date.now() - startedAt <= timeoutMs) {
    const job = await getPdfToWordJob(jobId);
    if (!job) throw new Error("The 200 MB job disappeared before completion.");
    if (job.status !== lastStatus) {
      console.log(`[phase1-200mb] status=${job.status} progress=${job.progress}`);
      lastStatus = job.status;
    }
    if (job.status === "done") return job;
    if (job.status === "error") throw new Error(job.error || "The 200 MB conversion failed.");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("The 200 MB conversion did not finish within 15 minutes.");
}

async function waitForJobHeartbeat(jobId: string) {
  const deadline = Date.now() + 15_000;
  let health = await getConversionWorkerHealth();
  while (health.heartbeat?.jobId !== jobId && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    health = await getConversionWorkerHealth();
  }
  return health;
}

async function main() {
  const fixture = await createExactSizeFixture();
  const uploadId = crypto.randomUUID();
  const storagePath = `temp-jobs/pdf-to-word/uploads/${uploadId}/input.pdf`;
  let uploaded = false;
  let completed: PdfToWordJob | undefined;

  try {
    const target = await createPdfBlobUploadTarget(storagePath, "application/pdf");
    if (target.provider !== "r2") {
      throw new Error(`Expected R2 storage but received ${target.provider}.`);
    }

    const uploadStartedAt = Date.now();
    await uploadExactFile(target.uploadUrl, fixture);
    uploaded = true;
    const uploadedInfo = await getPdfBlobObjectInfo(storagePath);
    if (uploadedInfo.size !== TARGET_BYTES) {
      throw new Error(`R2 stored ${uploadedInfo.size} bytes; expected ${TARGET_BYTES}.`);
    }

    const jobId = await createPdfToWordJob(
      "phase1-exact-200mb.pdf",
      `phase1-200mb:${crypto.randomUUID()}`,
      {
        sourceFileName: "phase1-exact-200mb.pdf",
        userId: null,
        sessionId: `phase1-200mb-${crypto.randomUUID()}`,
        ipAddress: null,
        inputBytes: TARGET_BYTES,
        inputPrepared: true,
      }
    );
    await stagePdfToWordJobInputFromStorage(jobId, storagePath, TARGET_BYTES);
    await enqueuePdfToWordJob(jobId);
    const finished = await waitForJob(jobId);
    completed = await consumePdfToWordJob(jobId);
    if (!completed) throw new Error("The completed 200 MB job could not be consumed.");

    const output = await readPdfToWordJobOutput(completed);
    const validation = await validateConversionOutput(output, "docx");
    if (!validation.valid) {
      throw new Error(`DOCX validation failed: ${validation.errors.join(" ")}`);
    }
    const worker = await waitForJobHeartbeat(jobId);
    if (!worker.ok || worker.heartbeat?.jobId !== jobId) {
      throw new Error(`Railway heartbeat did not confirm the 200 MB job ${jobId}.`);
    }

    const report = {
      generatedAt: new Date().toISOString(),
      jobId,
      inputBytes: TARGET_BYTES,
      uploadProvider: target.provider,
      uploadPath: storagePath,
      uploadTimeMs: finished.startedAt ? finished.startedAt - uploadStartedAt : null,
      queueTimeMs: finished.queueTimeMs ?? null,
      processingTimeMs: finished.processingTimeMs ?? null,
      outputBytes: output.length,
      outputSha256: crypto.createHash("sha256").update(output).digest("hex"),
      engine: finished.engine ?? null,
      validation,
      workerState: worker.heartbeat?.state ?? null,
      workerResult: worker.heartbeat?.result ?? null,
      fixtureKind: process.env.PHASE1_200MB_PDF ? "provided" : "valid-pdf-with-zero-padding",
    };
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (completed) {
      await releasePdfToWordJob(completed).catch(() => undefined);
    } else if (uploaded) {
      await deletePdfBlobObjects([storagePath]).catch(() => undefined);
    }
    if (!process.env.PHASE1_200MB_PDF) {
      await fs.rm(generatedFixture, { force: true }).catch(() => undefined);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
