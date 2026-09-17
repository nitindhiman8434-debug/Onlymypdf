import { beginToolRoute, handleToolRouteFailure } from "@/lib/server/tool-request-guards";
import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { wordToPdf } from "@/lib/services/word-to-pdf.service";
import { withHeavyJobGuard } from "@/lib/server/conversion-semaphore";
import { checkUsageLimit, checkFileSizeLimit } from "@/lib/services/usage-limit.service";
import { logToolUsage } from "@/lib/db/queries";
import { resolveMutationToolUser } from "@/lib/auth/tool-mutation-auth";
import { validateSingleUpload, uploadValidationResponse } from "@/lib/server/upload-validation";
import { sanitizeFilename } from "@/lib/utils/file";
import { FILE_LIMITS } from "@/config/constants";
import { clientIpForLogs, ownerHashFromRequest } from "@/lib/server/request-security";
import { createPdfSession } from "@/lib/pdf/pdf-session-store";
import { probePdfAccess } from "@/lib/pdf/pdf-password.server";
import {
  ConversionOutputValidationError,
  recordFailedConversion,
  validateAndRecordConversion,
} from "@/lib/services/conversion-completion.service";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const early = await beginToolRoute(request, "word-to-pdf");
  if (early) return early;

  const startTime = Date.now();
  let userId: string | null = null;
  let inputBytes: number | undefined;
  let conversionAttempted = false;

  try {
    const mutationAuth = await resolveMutationToolUser(request);
    if (mutationAuth.denied) return mutationAuth.denied;
    userId = mutationAuth.userId;

    const sizeResult = userId
      ? await checkFileSizeLimit(userId)
      : { maxSizeMB: FILE_LIMITS.maxFreeFileSizeMB };
    const maxSizeMB = sizeResult.maxSizeMB;

    const usageResult = await checkUsageLimit(userId, request, "word-to-pdf");
    if (!usageResult.allowed) {
      return toolJsonError(request, usageResult.message ?? "Daily usage limit reached.", 429);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return toolJsonError(request, "Word document is required", 400);
    }

    const validated = await validateSingleUpload(file, ["word"], maxSizeMB);
    if (!validated.ok) {
      if (validated.error === "Invalid file type.") {
        return toolJsonError(request, "Invalid file type. Only DOC/DOCX files are accepted.", 400);
      }
      return uploadValidationResponse(request, validated);
    }

    const buffer = validated.buffer;
    inputBytes = buffer.length;
    conversionAttempted = true;
    const pdfBuffer = await Promise.race([
      withHeavyJobGuard(() => wordToPdf(buffer, file.name)),
      new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                "Conversion timed out. Try a smaller file, or retry in a moment."
              )
            ),
          55_000
        );
      }),
    ]);

    await validateAndRecordConversion({
      toolName: "word-to-pdf",
      output: pdfBuffer,
      outputKind: "pdf",
      inputBytes,
      startedAt: startTime,
      engine: "office-auto",
    });

    const originalName = file.name.replace(/\.(doc|docx)$/i, "");

    const ownerHash = ownerHashFromRequest(request, userId);
    const probe = await probePdfAccess(pdfBuffer);
    const totalPages = probe.status === "ok" ? probe.pages : 0;
    const previewSessionId = await createPdfSession(pdfBuffer, ownerHash, { localOnly: true });

    const processingTime = Date.now() - startTime;
    const outputFileName = `${sanitizeFilename(originalName)}.pdf`;
    await logToolUsage({
      userId,
      sessionId: request.headers.get("x-session-id") || "anonymous",
      toolSlug: "word-to-pdf",
      ipAddress: clientIpForLogs(request),
      fileSize: buffer.length,
      processingTimeMs: processingTime,
      status: "completed",
      conversionMetricRecorded: true,
      inputFileNames: [file.name],
      output: {
        buffer: pdfBuffer,
        fileName: outputFileName,
        mimeType: "application/pdf",
      },
    }).catch(() => {});

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${outputFileName}"`,
        "Content-Length": String(pdfBuffer.length),
        "X-Pdf-Session-Id": previewSessionId,
        "X-Pdf-Total-Pages": String(totalPages),
      },
    });
  } catch (error) {
    if (conversionAttempted && !(error instanceof ConversionOutputValidationError)) {
      await recordFailedConversion({
        toolName: "word-to-pdf",
        startedAt: startTime,
        inputBytes,
        engine: "office-auto",
        error,
      });
    }
    return handleToolRouteFailure(error, { request, 
      toolSlug: "word-to-pdf",
      userId,
      errorType: "CONVERT_ERROR",
      fallbackMessage: "Failed to convert Word to PDF",
    });
  }
}
