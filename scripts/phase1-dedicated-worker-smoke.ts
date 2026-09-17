#!/usr/bin/env tsx

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { getConversionWorkerHealth } from "../src/lib/ops/conversion-worker-health";
import { validateConversionOutput } from "../src/lib/services/conversion-output-validation";
import {
  consumePdfToWordJob,
  createPdfToWordJob,
  enqueuePdfToWordJob,
  getPdfToWordJob,
  readPdfToWordJobOutput,
  releasePdfToWordJob,
  stagePdfToWordJobInput,
} from "../src/lib/services/pdf-to-word-jobs.service";

const fixturePath = path.resolve(
  process.env.PHASE1_SMOKE_PDF || path.join("test-lo-verify", "input.pdf")
);
const timeoutMs = 3 * 60 * 1000;

async function waitForJobHeartbeat(jobId: string) {
  const deadline = Date.now() + 15_000;
  let worker = await getConversionWorkerHealth();
  while (worker.heartbeat?.jobId !== jobId && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    worker = await getConversionWorkerHealth();
  }
  return worker;
}

async function main() {
  const source = await fs.readFile(fixturePath);
  const jobId = await createPdfToWordJob(
    path.basename(fixturePath),
    `phase1-dedicated:${crypto.randomUUID()}`,
    {
      sourceFileName: path.basename(fixturePath),
      userId: null,
      sessionId: `phase1-${crypto.randomUUID()}`,
      ipAddress: null,
      inputBytes: source.length,
      inputPrepared: true,
    }
  );

  await stagePdfToWordJobInput(jobId, source);
  await enqueuePdfToWordJob(jobId);

  const startedAt = Date.now();
  let status = await getPdfToWordJob(jobId);
  while (status && status.status !== "done" && status.status !== "error") {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Dedicated worker did not finish within three minutes.");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    status = await getPdfToWordJob(jobId);
  }
  if (!status) throw new Error("Dedicated worker job disappeared before completion.");
  if (status.status === "error") throw new Error(status.error || "Dedicated worker failed.");

  const completed = await consumePdfToWordJob(jobId);
  if (!completed) throw new Error("Completed job could not be consumed.");
  try {
    const output = await readPdfToWordJobOutput(completed);
    const validation = await validateConversionOutput(output, "docx");
    if (!validation.valid) {
      throw new Error(`DOCX validation failed: ${validation.errors.join(" ")}`);
    }
    // Job completion is persisted before the worker records its processed
    // heartbeat, so allow that final observability update to arrive.
    const worker = await waitForJobHeartbeat(jobId);
    if (!worker.ok || worker.heartbeat?.jobId !== jobId) {
      throw new Error(`Dedicated worker heartbeat did not confirm job ${jobId}.`);
    }

    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          fixture: path.relative(process.cwd(), fixturePath).replace(/\\/g, "/"),
          jobId,
          inputBytes: source.length,
          outputBytes: output.length,
          outputSha256: crypto.createHash("sha256").update(output).digest("hex"),
          engine: completed.engine ?? null,
          queueTimeMs: completed.queueTimeMs ?? null,
          processingTimeMs: completed.processingTimeMs ?? null,
          outputValid: completed.outputValidation?.valid ?? validation.valid,
          validation,
          workerState: worker.heartbeat?.state ?? null,
          workerResult: worker.heartbeat?.result ?? null,
        },
        null,
        2
      )
    );
  } finally {
    await releasePdfToWordJob(completed);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
