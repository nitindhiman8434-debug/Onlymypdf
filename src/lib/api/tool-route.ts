import { NextRequest, NextResponse } from "next/server";
import { checkUsageLimit } from "@/lib/services/usage-limit.service";
import { resolveToolUserContext } from "@/lib/services/user-tool-context.service";
import { withHeavyJobGuard } from "@/lib/server/conversion-semaphore";
import { logToolUsage, logError } from "@/lib/db/queries";
import { resolveMutationToolUser } from "@/lib/auth/tool-mutation-auth";
import { isValidFileType, validateFileSize, sanitizeFilename } from "@/lib/utils/file";
import { getGuestUsageKey } from "@/lib/server/client-ip";
import { guardToolRateLimit, guardApiKeyRateLimit } from "@/lib/server/rate-limiter";
import { guardToolMutationOrigin } from "@/lib/server/mutation-origin";
import { toSafeApiError, captureApiError } from "@/lib/server/safe-error";
import { toolJsonError } from "@/lib/server/tool-api-error";
import {
  passwordErrorResponseFromMessage,
  resolvePdfBufferErrorResponse,
} from "@/lib/server/pdf-password-http";
import { heavyJobCapacityResponse } from "@/lib/server/heavy-job-http";
import { authGuardResponse } from "@/lib/server/auth-guard-http";
import {
  isMaintenanceModeEnabled,
  MAINTENANCE_MESSAGE,
} from "@/lib/server/maintenance-mode";
import { validateBufferMagic } from "@/lib/utils/file-magic";
import { getGuestSessionLabel } from "@/lib/privacy/guest-session";
import { clientIpForLogs } from "@/lib/server/request-security";
import { resolvePdfBuffer } from "@/lib/pdf/pdf-password.server";
import {
  ConversionOutputValidationError,
  recordFailedConversion,
  validateAndRecordConversion,
} from "@/lib/services/conversion-completion.service";
import type { ConversionOutputKind } from "@/lib/services/conversion-output-validation";

interface ToolRouteOptions {
  toolSlug: string;
  allowedTypes: string[];
  contentType: string;
  outputExtension: string;
  maxDuration?: number;
  heavy?: boolean;
  /** Decrypt password-protected PDFs using optional `password` form field before convert. */
  unlockPdf?: boolean;
  passwordRequiredMessage?: string;
  convert: (buffer: Buffer, file: File, formData: FormData) => Promise<Buffer>;
  outputName?: (originalName: string) => string;
}

function outputKindFor(options: ToolRouteOptions): ConversionOutputKind | null {
  const extension = options.outputExtension.toLowerCase();
  if (["pdf", "docx", "xlsx", "pptx", "txt", "html"].includes(extension)) {
    return extension as ConversionOutputKind;
  }
  if (options.contentType.startsWith("image/")) return "image";
  return null;
}

export function createToolRoute(options: ToolRouteOptions) {
  const handler = async (request: NextRequest) => {
    const startTime = Date.now();
    let userId: string | null = null;
    let uploadFileName: string | undefined;
    let inputBytes: number | undefined;
    let conversionAttempted = false;

    try {
      const originBlocked = guardToolMutationOrigin(request);
      if (originBlocked) {
        return toolJsonError(request, "Invalid request origin", 403);
      }

      if (await isMaintenanceModeEnabled()) {
        return toolJsonError(request, MAINTENANCE_MESSAGE, 503);
      }

      const toolRate = await guardToolRateLimit(request, options.toolSlug);
      if (toolRate) return toolRate;

      const apiKeyRate = await guardApiKeyRateLimit(request, options.toolSlug);
      if (apiKeyRate) return apiKeyRate;

      const mutationAuth = await resolveMutationToolUser(request);
      if (mutationAuth.denied) return mutationAuth.denied;
      userId = mutationAuth.userId;

      const userContext = await resolveToolUserContext(userId);
      const maxSizeMB = userContext.maxSizeMB;

      const usageResult = await checkUsageLimit(
        userId,
        getGuestUsageKey(request),
        options.toolSlug
      );
      if (!usageResult.allowed) {
        return toolJsonError(request, usageResult.message ?? "Daily usage limit reached.", 429);
      }

      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      uploadFileName = file?.name;

      if (!file) {
        return toolJsonError(request, "File is required", 400);
      }

      if (!isValidFileType(file, options.allowedTypes)) {
        return toolJsonError(
          request,
          `Invalid file type for ${options.toolSlug}.`,
          400
        );
      }

      const sizeCheck = validateFileSize(file, maxSizeMB);
      if (!sizeCheck.valid) {
        return toolJsonError(request, sizeCheck.message ?? "File is too large.", 400);
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(await file.arrayBuffer());
      } catch {
        return toolJsonError(request, "Could not read uploaded file.", 400);
      }

      if (buffer.length === 0) {
        return toolJsonError(request, "File is empty.", 400);
      }

      const magic = validateBufferMagic(buffer, options.allowedTypes);
      if (!magic.valid) {
        return toolJsonError(
          request,
          magic.message ?? "Invalid file content.",
          400
        );
      }

      if (options.unlockPdf) {
        const password =
          (formData.get("password") as string | null)?.trim() || undefined;
        try {
          buffer = await resolvePdfBuffer(buffer, password);
        } catch (err) {
          const passwordError = resolvePdfBufferErrorResponse(request, err, {
            fileName: uploadFileName,
            requiredMessage: options.passwordRequiredMessage,
          });
          if (passwordError) return passwordError;
          throw err;
        }
      }

      inputBytes = buffer.length;

      const runConvert = () => options.convert(buffer, file, formData);
      conversionAttempted = true;
      const outputBuffer = options.heavy
        ? await withHeavyJobGuard(runConvert)
        : await runConvert();

      const outputKind = outputKindFor(options);
      if (outputKind) {
        await validateAndRecordConversion({
          toolName: options.toolSlug,
          output: outputBuffer,
          outputKind,
          inputBytes,
          startedAt: startTime,
          engine: options.heavy ? "heavy-auto" : "node",
        });
      }

      const baseName = options.outputName
        ? options.outputName(file.name)
        : file.name.replace(/\.[^.]+$/, "");
      const outputFileName = `${sanitizeFilename(baseName)}.${options.outputExtension}`;

      await logToolUsage({
        userId,
        sessionId: getGuestSessionLabel(request),
        toolSlug: options.toolSlug,
        ipAddress: clientIpForLogs(request),
        fileSize: buffer.length,
        processingTimeMs: Date.now() - startTime,
        status: "completed",
        conversionMetricRecorded: true,
        inputFileNames: [file.name],
        output: {
          buffer: outputBuffer,
          fileName: outputFileName,
          mimeType: options.contentType,
        },
      }).catch((logErr) => {
        void logError({
          user_id: userId,
          tool_name: options.toolSlug,
          error_type: "USAGE_LOG_FAILURE",
          error_message:
            logErr instanceof Error ? logErr.message : "Failed to log tool usage",
        }).catch(() => {});
      });

      return new NextResponse(new Uint8Array(outputBuffer), {
        status: 200,
        headers: {
          "Content-Type": options.contentType,
          "Content-Disposition": `attachment; filename="${outputFileName}"`,
          "Content-Length": String(outputBuffer.length),
        },
      });
    } catch (error) {
      if (conversionAttempted && !(error instanceof ConversionOutputValidationError)) {
        await recordFailedConversion({
          toolName: options.toolSlug,
          startedAt: startTime,
          inputBytes,
          engine: options.heavy ? "heavy-auto" : "node",
          error,
        });
      }
      const blocked = authGuardResponse(error);
      if (blocked) return blocked;

      const capacity = heavyJobCapacityResponse(error);
      if (capacity) return capacity;

      const passwordError =
        resolvePdfBufferErrorResponse(request, error, { fileName: uploadFileName }) ??
        passwordErrorResponseFromMessage(
          request,
          error instanceof Error ? error.message : "",
          uploadFileName
        );
      if (passwordError) return passwordError;

      const message = toSafeApiError(error, "Processing failed");

      await logError({
        user_id: userId,
        tool_name: options.toolSlug,
        error_type: "TOOL_ERROR",
        error_message: error instanceof Error ? error.message : message,
        stack_trace: error instanceof Error ? error.stack : undefined,
      }).catch(() => {});

      captureApiError(error, { route: `tools/${options.toolSlug}`, user_id: userId });

      return toolJsonError(request, message, 500);
    }
  };

  return handler;
}

export const TOOL_MAX_DURATION = 60;
