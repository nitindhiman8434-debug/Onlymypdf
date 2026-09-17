import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { pdfToWord, mapPdfToWordError } from "@/lib/services/pdf-to-word.service";
import {
  completePdfToWordJob,
  createPdfToWordJob,
  failPdfToWordJob,
  updatePdfToWordJobProgress,
} from "@/lib/services/pdf-to-word-jobs.service";
import { checkUsageLimit } from "@/lib/services/usage-limit.service";
import { resolveToolUserContext } from "@/lib/services/user-tool-context.service";
import { logToolUsage, logError } from "@/lib/db/queries";
import { resolveMutationToolUser } from "@/lib/auth/tool-mutation-auth";
import { validateSingleUpload, uploadValidationResponse } from "@/lib/server/upload-validation";
import { sanitizeFilename } from "@/lib/utils/file";
import { clientIpForLogs } from "@/lib/server/request-security";
import { resolvePdfBuffer } from "@/lib/pdf/pdf-password.server";
import {
  PASSWORD_REQUIRED_CODE,
  WRONG_PASSWORD_CODE,
} from "@/lib/server/pdf-password-http";
import { withHeavyJobGuard } from "@/lib/server/conversion-semaphore";
import { heavyJobCapacityResponse, isHeavyJobCapacityError } from "@/lib/server/heavy-job-http";
import { userBlockedResponse } from "@/lib/server/user-blocked-http";
import { guardMaintenanceMode } from "@/lib/server/tool-request-guards";
import { guardToolRateLimit, guardApiKeyRateLimit } from "@/lib/server/rate-limiter";
import { toSafeApiError } from "@/lib/server/safe-error";
import { guardToolMutationOrigin } from "@/lib/server/mutation-origin";
import { getGuestUsageKey } from "@/lib/server/client-ip";
import { resolveToolJobOwnerKey } from "@/lib/server/job-owner";

export const maxDuration = 600;

function wantsJobMode(request: NextRequest): boolean {
  return request.headers.get("x-pdf-to-word-job") === "1";
}

function parsePassword(formData: FormData): string | undefined {
  const raw = formData.get("options");
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as { password?: unknown };
    return typeof parsed.password === "string" && parsed.password.length > 0
      ? parsed.password
      : undefined;
  } catch {
    return undefined;
  }
}

function passwordErrorResponse(request: NextRequest, message: string, fileName?: string) {
  const mapped = mapPdfToWordError(message);
  if (mapped === "PASSWORD_REQUIRED") {
    return toolJsonError(
      request,
      "This PDF is password-protected. Enter the password to convert.",
      422,
      {
        code: PASSWORD_REQUIRED_CODE,
        ...(fileName ? { fileName } : {}),
      }
    );
  }
  if (mapped === "WRONG_PASSWORD") {
    return toolJsonError(request, "Incorrect password. Please try again.", 422, {
      code: WRONG_PASSWORD_CODE,
      ...(fileName ? { fileName } : {}),
    });
  }
  return null;
}

async function preparePdfInput(
  buffer: Buffer,
  password?: string
): Promise<Buffer> {
  return await resolvePdfBuffer(buffer, password);
}

async function runConversionJob(
  jobId: string,
  inputPath: string,
  workDir: string,
  outputPath: string,
  fileName: string,
  meta: {
    userId: string | null;
    sessionId: string;
    ipAddress: string | null;
    startTime: number;
    fileSize: number;
    pdfPassword?: string;
    outputFileName: string;
  }
) {
  const docxMime =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  try {
    const inputStat = await fs.stat(inputPath);
    const result = await withHeavyJobGuard(() =>
      pdfToWord({
        fileName,
        inputPath,
        outputPath,
        pdfPassword: meta.pdfPassword,
        onProgress: (percent) => void updatePdfToWordJobProgress(jobId, percent),
      })
    );

    const finalOutputPath = result.outputPath ?? outputPath;

    await completePdfToWordJob(jobId, {
      outputPath: finalOutputPath,
      workDir,
      engine: result.engine,
    });

    const usageBase = {
      userId: meta.userId,
      sessionId: meta.sessionId,
      toolSlug: "pdf-to-word" as const,
      ipAddress: meta.ipAddress,
      fileSize: inputStat.size,
      processingTimeMs: Date.now() - meta.startTime,
      status: "completed" as const,
      inputFileNames: [fileName],
    };

    if (meta.userId) {
      // Usage logging must never fail the (already completed) conversion — a
      // read error here previously surfaced to the user as an ENOENT.
      let outputBuffer: Buffer | null = null;
      try {
        outputBuffer = await fs.readFile(finalOutputPath);
      } catch {
        outputBuffer = null;
      }
      void logToolUsage(
        outputBuffer
          ? {
              ...usageBase,
              output: {
                buffer: outputBuffer,
                fileName: meta.outputFileName,
                mimeType: docxMime,
              },
            }
          : usageBase
      ).catch(() => {});
    } else {
      void logToolUsage(usageBase).catch(() => {});
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Failed to convert PDF to Word";
    const mapped = isHeavyJobCapacityError(error) ? raw : mapPdfToWordError(raw);
    const message = toSafeApiError(new Error(mapped), "Conversion failed. Please try again.");
    await failPdfToWordJob(jobId, message, workDir);
    await logError({
      user_id: meta.userId,
      tool_name: "pdf-to-word",
      error_type: "CONVERT_ERROR",
      error_message: message,
      stack_trace: error instanceof Error ? error.stack : undefined,
    }).catch(() => {});
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | null = null;

  try {
    const originBlocked = guardToolMutationOrigin(request);
    if (originBlocked) {
      return toolJsonError(request, "Invalid request origin", 403);
    }

    const maintenance = await guardMaintenanceMode(request);
    if (maintenance) return maintenance;

    const apiKeyRate = await guardApiKeyRateLimit(request, "pdf-to-word");
    if (apiKeyRate) return apiKeyRate;

    const toolRate = await guardToolRateLimit(request, "pdf-to-word");
    if (toolRate) return toolRate;

    const mutationAuth = await resolveMutationToolUser(request);
    if (mutationAuth.denied) return mutationAuth.denied;
    userId = mutationAuth.userId;
    const userContext = await resolveToolUserContext(userId);
    const maxSizeMB = userContext.maxSizeMB;

    const usage = await checkUsageLimit(userId, getGuestUsageKey(request));
    if (!usage.allowed) {
      return toolJsonError(request, usage.message || "Daily usage limit reached.", 429);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return toolJsonError(request, "PDF file is required", 400);
    }

    const validated = await validateSingleUpload(file, ["pdf"], maxSizeMB);
    if (!validated.ok) {
      if (validated.error === "Invalid file type.") {
        return toolJsonError(request, "Invalid file type. Only PDF files are accepted.", 400);
      }
      return uploadValidationResponse(request, validated);
    }

    const buffer = validated.buffer;
    const originalName = file.name.replace(/\.pdf$/i, "");
    const outputFilename = `${sanitizeFilename(originalName)}.docx`;
    const pdfPassword = parsePassword(formData);

    let prepared: Buffer;
    try {
      prepared = await preparePdfInput(buffer, pdfPassword);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const passwordResponse = passwordErrorResponse(request, message);
      if (passwordResponse) return passwordResponse;
      throw err;
    }

    if (wantsJobMode(request)) {
      const ownerKey = await resolveToolJobOwnerKey(request);
      const jobId = await createPdfToWordJob(outputFilename, ownerKey);
      const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdfdoctor-ptw-job-"));
      const inputPath = path.join(workDir, "input.pdf");
      // Fixed internal name — engines must not write user-facing names (spaces/special
      // chars break Word COM / LibreOffice on Windows temp paths).
      const outputPath = path.join(workDir, "output.docx");
      await fs.writeFile(inputPath, prepared);

      void runConversionJob(jobId, inputPath, workDir, outputPath, file.name, {
        userId,
        sessionId: request.headers.get("x-session-id") || "anonymous",
        ipAddress: getGuestUsageKey(request),
        startTime,
        fileSize: prepared.length,
        pdfPassword,
        outputFileName: outputFilename,
      });
      return NextResponse.json({ jobId });
    }

    const { buffer: docxBuffer, engine } = await withHeavyJobGuard(() =>
      pdfToWord({
        buffer: prepared,
        fileName: file.name,
        pdfPassword,
      })
    );

    if (!docxBuffer) {
      throw new Error("Conversion failed to produce a Word file");
    }

    void logToolUsage({
      userId,
      sessionId: request.headers.get("x-session-id") || "anonymous",
      toolSlug: "pdf-to-word",
      ipAddress: clientIpForLogs(request),
      fileSize: prepared.length,
      processingTimeMs: Date.now() - startTime,
      status: "completed",
      inputFileNames: [file.name],
      output: {
        buffer: docxBuffer,
        fileName: outputFilename,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    }).catch(() => {});

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${outputFilename}"`,
        "Content-Length": String(docxBuffer.length),
        "X-Pdf-Engine": engine,
      },
    });
  } catch (error) {
    const blocked = userBlockedResponse(error);
    if (blocked) return blocked;

    const capacity = heavyJobCapacityResponse(error);
    if (capacity) return capacity;

    const raw = error instanceof Error ? error.message : "Failed to convert PDF to Word";
    const message = mapPdfToWordError(raw);

    await logError({
      user_id: userId,
      tool_name: "pdf-to-word",
      error_type: "CONVERT_ERROR",
      error_message: message,
      stack_trace: error instanceof Error ? error.stack : undefined,
    }).catch(() => {});

    if (message === "PASSWORD_REQUIRED") {
      return toolJsonError(request, "This PDF is password-protected. Enter the password to convert.", 422);
    }
    if (message === "WRONG_PASSWORD") {
      return toolJsonError(request, "Incorrect password. Please try again.", 422);
    }

    if (message.includes("usage limit") || message.includes("limit reached")) {
      return toolJsonError(request, message, 429);
    }

    return toolJsonError(request, message, 500);
  }
}
