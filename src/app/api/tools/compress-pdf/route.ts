import { beginToolRoute, handleToolRouteFailure } from "@/lib/server/tool-request-guards";
import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { compressPDF } from "@/lib/services/pdf-compress.service";
import { resolvePdfBuffer } from "@/lib/pdf/pdf-password.server";
import { resolvePdfBufferErrorResponse } from "@/lib/server/pdf-password-http";
import { checkUsageLimit, checkFileSizeLimit } from "@/lib/services/usage-limit.service";
import { logToolUsage } from "@/lib/db/queries";
import { resolveMutationToolUser } from "@/lib/auth/tool-mutation-auth";
import { validateSingleUpload, uploadValidationResponse } from "@/lib/server/upload-validation";
import { FILE_LIMITS } from "@/config/constants";
import { clientIpForLogs } from "@/lib/server/request-security";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const early = await beginToolRoute(request, "compress-pdf");
  if (early) return early;

  const startTime = Date.now();
  let userId: string | null = null;

  try {
    const mutationAuth = await resolveMutationToolUser(request);
    if (mutationAuth.denied) return mutationAuth.denied;
    userId = mutationAuth.userId;

    const sizeResult = userId
      ? await checkFileSizeLimit(userId)
      : { maxSizeMB: FILE_LIMITS.maxFreeFileSizeMB };
    const maxSizeMB = sizeResult.maxSizeMB;

    const usageResult = await checkUsageLimit(userId, request, "compress-pdf");
    if (!usageResult.allowed) {
      return toolJsonError(request, usageResult.message ?? "Daily usage limit reached.", 429);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const level = (formData.get("level") as string) || "basic";

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

    if (!["basic", "strong"].includes(level)) {
      return toolJsonError(request, "Invalid compression level", 400);
    }

    const password = (formData.get("password") as string | null) || null;
    let buffer: Buffer;

    try {
      buffer = await resolvePdfBuffer(validated.buffer, password);
    } catch (err) {
      const passwordError = resolvePdfBufferErrorResponse(request, err, {
        requiredMessage:
          "This PDF is password-protected. Enter the password to compress.",
        fileName: file.name,
      });
      if (passwordError) return passwordError;
      const msg = err instanceof Error ? err.message : "Failed to open PDF";
      return toolJsonError(request, msg, 400);
    }

    const originalSize = buffer.length;
    const result = await compressPDF(buffer, level as "basic" | "strong", password ?? undefined);
    const compressedSize = result.compressedSize;
    const savedPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);

    const processingTime = Date.now() - startTime;
    await logToolUsage({
      userId,
      sessionId: request.headers.get("x-session-id") || "anonymous",
      toolSlug: "compress-pdf",
      ipAddress: clientIpForLogs(request),
      fileSize: originalSize,
      processingTimeMs: processingTime,
      status: "completed",
      inputFileNames: [file.name],
      output: {
        buffer: result.buffer,
        fileName: "compressed.pdf",
        mimeType: "application/pdf",
      },
    }).catch(() => {});

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="compressed.pdf"',
        "Content-Length": String(compressedSize),
        "X-Original-Size": String(originalSize),
        "X-Compressed-Size": String(compressedSize),
        "X-Saved-Percent": String(savedPercent),
        "X-Compression-Status": result.status,
        "X-Compression-Method": result.method,
      },
    });
  } catch (error) {
    return handleToolRouteFailure(error, { request, 
      toolSlug: "compress-pdf",
      userId,
      errorType: "COMPRESS_ERROR",
      fallbackMessage: "Failed to compress PDF",
    });
  }
}
