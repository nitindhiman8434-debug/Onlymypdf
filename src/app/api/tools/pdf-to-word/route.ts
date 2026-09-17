import { after, NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { pdfToWord, mapPdfToWordError } from "@/lib/services/pdf-to-word.service";
import {
  createPdfToWordJob,
  enqueuePdfToWordJob,
  failPdfToWordJob,
  stagePdfToWordJobInput,
  stagePdfToWordJobInputFromStorage,
} from "@/lib/services/pdf-to-word-jobs.service";
import { processNextPdfToWordJob } from "@/lib/services/pdf-to-word-worker.service";
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
import { heavyJobCapacityResponse } from "@/lib/server/heavy-job-http";
import { userBlockedResponse } from "@/lib/server/user-blocked-http";
import { guardMaintenanceMode } from "@/lib/server/tool-request-guards";
import { guardToolRateLimit, guardApiKeyRateLimit } from "@/lib/server/rate-limiter";
import { guardToolMutationOrigin } from "@/lib/server/mutation-origin";
import { getGuestUsageKey } from "@/lib/server/client-ip";
import { resolveToolJobOwnerKey } from "@/lib/server/job-owner";
import {
  ConversionOutputValidationError,
  recordFailedConversion,
  validateAndRecordConversion,
} from "@/lib/services/conversion-completion.service";
import type { PdfToWordEngine } from "@/lib/services/pdf-to-word.service";
import { verifyPdfToWordUploadGrant } from "@/lib/server/direct-upload-grant";
import { claimOneTimeKey } from "@/lib/server/upstash-kv";
import { encryptJobPayloadSecret } from "@/lib/server/job-payload-secret";
import { isUnlimitedFileSizeMB } from "@/config/constants";

export const maxDuration = 600;

function wantsJobMode(request: NextRequest): boolean {
  return request.headers.get("x-pdf-to-word-job") === "1";
}

function shouldRunInlineWorker(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.INLINE_CONVERSION_WORKER === "1";
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

type DirectJobRequest = {
  uploadGrant?: unknown;
  options?: { password?: unknown };
};

function directPassword(body: DirectJobRequest): string | undefined {
  const value = body.options?.password;
  if (typeof value !== "string" || value.length === 0) return undefined;
  if (value.length > 1024) throw new Error("PDF password is too long.");
  return value;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | null = null;
  let syncInputBytes: number | undefined;
  let syncConversionAttempted = false;
  const syncAttempts: PdfToWordEngine[] = [];

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

    const requestContentType = request.headers.get("content-type") || "";
    if (requestContentType.toLowerCase().includes("application/json")) {
      if (!wantsJobMode(request)) {
        return toolJsonError(request, "Direct uploads require job mode.", 400);
      }
      let body: DirectJobRequest;
      try {
        body = (await request.json()) as DirectJobRequest;
      } catch {
        return toolJsonError(request, "Invalid direct upload request.", 400);
      }
      if (typeof body.uploadGrant !== "string") {
        return toolJsonError(request, "Secure upload grant is required.", 400);
      }

      const ownerKey = await resolveToolJobOwnerKey(request);
      const grant = verifyPdfToWordUploadGrant(body.uploadGrant, ownerKey);
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (!isUnlimitedFileSizeMB(maxSizeMB) && grant.fileSize > maxBytes) {
        return toolJsonError(request, `File size exceeds the ${maxSizeMB} MB plan limit.`, 400);
      }
      const claimed = await claimOneTimeKey(
        `pdf-to-word:upload-grant:${grant.id}`,
        2 * 60 * 60
      );
      if (!claimed) {
        return toolJsonError(request, "This secure upload was already used or expired.", 409);
      }

      const pdfPassword = directPassword(body);
      const originalName = grant.fileName.replace(/\.pdf$/i, "");
      const outputFilename = `${sanitizeFilename(originalName)}.docx`;
      const jobId = await createPdfToWordJob(outputFilename, ownerKey, {
        sourceFileName: grant.fileName,
        userId,
        sessionId: request.headers.get("x-session-id") || "anonymous",
        ipAddress: getGuestUsageKey(request),
        inputBytes: grant.fileSize,
        inputPrepared: false,
        encryptedPdfPassword: pdfPassword
          ? encryptJobPayloadSecret(pdfPassword)
          : undefined,
      });
      try {
        await stagePdfToWordJobInputFromStorage(jobId, grant.path, grant.fileSize);
        await enqueuePdfToWordJob(jobId);
      } catch (error) {
        await failPdfToWordJob(jobId, error);
        throw error;
      }

      if (shouldRunInlineWorker()) {
        after(async () => {
          await processNextPdfToWordJob();
        });
      }
      return NextResponse.json({ jobId, status: "queued" }, { status: 202 });
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
      const jobId = await createPdfToWordJob(outputFilename, ownerKey, {
        sourceFileName: file.name,
        userId,
        sessionId: request.headers.get("x-session-id") || "anonymous",
        ipAddress: getGuestUsageKey(request),
        inputBytes: prepared.length,
        inputPrepared: true,
      });
      try {
        await stagePdfToWordJobInput(jobId, prepared);
        await enqueuePdfToWordJob(jobId);
      } catch (error) {
        await failPdfToWordJob(jobId, error);
        throw error;
      }

      if (shouldRunInlineWorker()) {
        after(async () => {
          await processNextPdfToWordJob();
        });
      }
      return NextResponse.json({ jobId, status: "queued" }, { status: 202 });
    }

    syncInputBytes = prepared.length;
    syncConversionAttempted = true;
    const { buffer: docxBuffer, engine } = await withHeavyJobGuard(() =>
      pdfToWord({
        buffer: prepared,
        fileName: file.name,
        pdfPassword,
        onEngineAttempt: (attemptedEngine) => syncAttempts.push(attemptedEngine),
      })
    );

    if (!docxBuffer) {
      throw new Error("Conversion failed to produce a Word file");
    }

    await validateAndRecordConversion({
      toolName: "pdf-to-word",
      output: docxBuffer,
      outputKind: "docx",
      inputBytes: syncInputBytes,
      startedAt: startTime,
      engine,
      attemptCount: Math.max(1, syncAttempts.length),
    });

    void logToolUsage({
      userId,
      sessionId: request.headers.get("x-session-id") || "anonymous",
      toolSlug: "pdf-to-word",
      ipAddress: clientIpForLogs(request),
      fileSize: prepared.length,
      processingTimeMs: Date.now() - startTime,
      status: "completed",
      conversionMetricRecorded: true,
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
    if (syncConversionAttempted && !(error instanceof ConversionOutputValidationError)) {
      await recordFailedConversion({
        toolName: "pdf-to-word",
        startedAt: startTime,
        inputBytes: syncInputBytes,
        engine: syncAttempts.at(-1),
        attemptCount: Math.max(1, syncAttempts.length),
        error,
      });
    }
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
