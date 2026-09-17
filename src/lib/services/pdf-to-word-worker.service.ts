import fs from "fs/promises";
import { logError, logToolUsage } from "@/lib/db/queries";
import { recordConversionMetric } from "@/lib/ops/conversion-telemetry";
import { withHeavyJobGuard } from "@/lib/server/conversion-semaphore";
import { toSafeApiError } from "@/lib/server/safe-error";
import {
  claimNextPdfToWordJob,
  completePdfToWordJob,
  failPdfToWordJob,
  getPdfToWordJob,
  materializePdfToWordJobInput,
  notePdfToWordEngineAttempt,
  updatePdfToWordJobProgress,
} from "./pdf-to-word-jobs.service";
import { mapPdfToWordError, pdfToWord, type PdfToWordEngine } from "./pdf-to-word.service";
import { resolvePdfBuffer } from "@/lib/pdf/pdf-password.server";
import { validateBufferMagic } from "@/lib/utils/file-magic";
import { decryptJobPayloadSecret } from "@/lib/server/job-payload-secret";

export type PdfToWordWorkerResult = {
  processed: boolean;
  jobId?: string;
  status?: "completed" | "failed";
};

export async function processNextPdfToWordJob(): Promise<PdfToWordWorkerResult> {
  const claimed = await claimNextPdfToWordJob();
  if (!claimed) return { processed: false };

  const { id: jobId } = claimed;
  const attempts: PdfToWordEngine[] = [];
  let workDir: string | undefined;
  try {
    const files = await materializePdfToWordJobInput(jobId);
    workDir = files.workDir;
    const context = files.job.context;
    if (!context) throw new Error("Conversion job context is missing.");

    const pdfPassword = context.encryptedPdfPassword
      ? decryptJobPayloadSecret(context.encryptedPdfPassword)
      : undefined;
    if (!context.inputPrepared) {
      const uploaded = await fs.readFile(files.inputPath);
      const magic = validateBufferMagic(uploaded, ["pdf"]);
      if (!magic.valid) {
        throw new Error(magic.message || "Uploaded file content is not a PDF.");
      }
      const prepared = await resolvePdfBuffer(uploaded, pdfPassword);
      await fs.writeFile(files.inputPath, prepared);
    }

    const result = await withHeavyJobGuard(() =>
      pdfToWord({
        fileName: context.sourceFileName,
        inputPath: files.inputPath,
        outputPath: files.outputPath,
        pdfPassword,
        onProgress: (percent) => void updatePdfToWordJobProgress(jobId, percent),
        onEngineAttempt: (engine) => attempts.push(engine),
      })
    );
    const finalOutputPath = result.outputPath ?? files.outputPath;
    for (let index = 0; index < attempts.length; index += 1) {
      await notePdfToWordEngineAttempt(jobId, attempts[index], index + 1);
    }
    if (attempts.length === 0) {
      await notePdfToWordEngineAttempt(jobId, result.engine, 1);
    }
    await completePdfToWordJob(jobId, {
      outputPath: finalOutputPath,
      workDir: files.workDir,
      engine: result.engine,
    });

    const completed = await getPdfToWordJob(jobId);
    const outputBuffer = await fs.readFile(finalOutputPath);
    const usageBase = {
      userId: context.userId,
      sessionId: context.sessionId,
      toolSlug: "pdf-to-word" as const,
      ipAddress: context.ipAddress,
      fileSize: context.inputBytes,
      processingTimeMs: completed?.processingTimeMs,
      status: "completed" as const,
      conversionMetricRecorded: true,
      inputFileNames: [context.sourceFileName],
    };
    void logToolUsage(
      context.userId
        ? {
            ...usageBase,
            output: {
              buffer: outputBuffer,
              fileName: files.job.filename,
              mimeType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            },
          }
        : usageBase
    ).catch(() => {});

    await recordConversionMetric({
      jobId,
      toolName: "pdf-to-word",
      status: "completed",
      engine: result.engine,
      inputBytes: context.inputBytes,
      outputBytes: outputBuffer.length,
      queueTimeMs: completed?.queueTimeMs,
      processingTimeMs: completed?.processingTimeMs,
      attemptCount: Math.max(1, attempts.length),
      fallbackUsed: attempts.length > 1,
      validation: completed?.outputValidation,
      occurredAt: new Date().toISOString(),
    });
    return { processed: true, jobId, status: "completed" };
  } catch (error) {
    for (let index = 0; index < attempts.length; index += 1) {
      await notePdfToWordEngineAttempt(jobId, attempts[index], index + 1);
    }
    const raw = error instanceof Error ? error.message : "Failed to convert PDF to Word";
    const mapped = mapPdfToWordError(raw);
    const message = toSafeApiError(new Error(mapped), "Conversion failed. Please try again.");
    await failPdfToWordJob(jobId, message, workDir);
    const failed = await getPdfToWordJob(jobId);
    await recordConversionMetric({
      jobId,
      toolName: "pdf-to-word",
      status: "failed",
      inputBytes: failed?.context?.inputBytes,
      queueTimeMs: failed?.queueTimeMs,
      processingTimeMs: failed?.processingTimeMs,
      attemptCount: Math.max(1, attempts.length),
      fallbackUsed: attempts.length > 1,
      errorCode: error instanceof Error ? error.name : "CONVERT_ERROR",
      occurredAt: new Date().toISOString(),
    });
    await logError({
      user_id: failed?.context?.userId,
      tool_name: "pdf-to-word",
      error_type: "CONVERT_ERROR",
      error_message: message,
      stack_trace: error instanceof Error ? error.stack : undefined,
    }).catch(() => {});
    return { processed: true, jobId, status: "failed" };
  }
}

export async function drainPdfToWordQueue(maxJobs = 1): Promise<PdfToWordWorkerResult[]> {
  const limit = Math.min(Math.max(1, maxJobs), 10);
  const results: PdfToWordWorkerResult[] = [];
  for (let index = 0; index < limit; index += 1) {
    const result = await processNextPdfToWordJob();
    results.push(result);
    if (!result.processed) break;
  }
  return results;
}
