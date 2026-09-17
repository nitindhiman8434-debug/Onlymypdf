import { beginToolRoute, handleToolRouteFailure } from "@/lib/server/tool-request-guards";
import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { htmlFileToPdf } from "@/lib/services/html-to-pdf-convert.service";
import { checkUsageLimit, checkFileSizeLimit } from "@/lib/services/usage-limit.service";
import { logToolUsage } from "@/lib/db/queries";
import { resolveMutationToolUser } from "@/lib/auth/tool-mutation-auth";
import { validateSingleUpload, uploadValidationResponse } from "@/lib/server/upload-validation";
import { sanitizeFilename } from "@/lib/utils/file";
import { FILE_LIMITS } from "@/config/constants";
import { createPdfSession } from "@/lib/pdf/pdf-session-store";
import { clientIpForLogs, ownerHashFromRequest } from "@/lib/server/request-security";
import { withHeavyJobGuard } from "@/lib/server/conversion-semaphore";
import { PDFDocument } from "pdf-lib";
import {
  ConversionOutputValidationError,
  recordFailedConversion,
  validateAndRecordConversion,
} from "@/lib/services/conversion-completion.service";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const early = await beginToolRoute(request, "html-to-pdf");
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

    const usageResult = await checkUsageLimit(userId, request, "html-to-pdf");
    if (!usageResult.allowed) {
      return toolJsonError(request, usageResult.message ?? "Daily usage limit reached.", 429);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const pageSize = (formData.get("pageSize") as string) || "a4";
    const orientation = (formData.get("orientation") as string) || "portrait";
    const margin = (formData.get("margin") as string) || "small";

    if (!file) {
      return toolJsonError(request, "HTML file is required", 400);
    }

    const validated = await validateSingleUpload(file, ["html"], maxSizeMB);
    if (!validated.ok) {
      if (validated.error === "Invalid file type.") {
        return toolJsonError(request, "Invalid file type. Only HTML files are accepted.", 400);
      }
      return uploadValidationResponse(request, validated);
    }

    const buffer = validated.buffer;
    inputBytes = buffer.length;
    conversionAttempted = true;
    const pdfBuffer = await withHeavyJobGuard(() =>
      htmlFileToPdf(buffer, file.name, {
        pageSize: pageSize as "a4" | "letter" | "auto",
        orientation: orientation as "portrait" | "landscape",
        margin: margin as "none" | "small" | "medium",
      })
    );

    await validateAndRecordConversion({
      toolName: "html-to-pdf",
      output: pdfBuffer,
      outputKind: "pdf",
      inputBytes,
      startedAt: startTime,
      engine: "chromium",
    });

    const originalName = file.name.replace(/\.(html?|xhtml|mhtml|svg)$/i, "");

    const ownerHash = ownerHashFromRequest(request, userId);
    const [previewSessionId, totalPages] = await Promise.all([
      createPdfSession(pdfBuffer, ownerHash, { localOnly: true }),
      PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
        .then((doc) => doc.getPageCount())
        .catch(() => 0),
    ]);

    const processingTime = Date.now() - startTime;
    const outputFileName = `${sanitizeFilename(originalName)}.pdf`;
    void logToolUsage({
      userId,
      sessionId: request.headers.get("x-session-id") || "anonymous",
      toolSlug: "html-to-pdf",
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
        toolName: "html-to-pdf",
        startedAt: startTime,
        inputBytes,
        engine: "chromium",
        error,
      });
    }
    return handleToolRouteFailure(error, { request, 
      toolSlug: "html-to-pdf",
      userId,
      errorType: "CONVERT_ERROR",
      fallbackMessage: "Failed to convert HTML to PDF",
    });
  }
}
