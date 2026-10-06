import { beginToolRoute, handleToolRouteFailure } from "@/lib/server/tool-request-guards";
import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { jpgToPdf } from "@/lib/services/pdf-convert.service";
import { checkUsageLimit, checkFileSizeLimit } from "@/lib/services/usage-limit.service";
import { logToolUsage } from "@/lib/db/queries";
import { resolveMutationToolUser } from "@/lib/auth/tool-mutation-auth";
import { validateSingleUpload, uploadValidationResponse } from "@/lib/server/upload-validation";
import { FILE_LIMITS } from "@/config/constants";
import { clientIpForLogs } from "@/lib/server/request-security";
import { SCANNER_MAX_IMAGES, parseScannerFilter } from "@/config/pdf-scanner";
import { prepareScannerImage } from "@/lib/services/pdf-scanner-image";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const early = await beginToolRoute(request, "pdf-scanner");
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

    const usageResult = await checkUsageLimit(userId, request, "pdf-scanner");
    if (!usageResult.allowed) {
      return toolJsonError(request, usageResult.message ?? "Daily usage limit reached.", 429);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return toolJsonError(request, "Upload too large or invalid. Try fewer images or check your connection.", 413);
    }
    const entries = formData.getAll("files");
    const filter = parseScannerFilter(formData.get("filter"));
    if (filter === null || formData.getAll("filter").length > 1) {
      return toolJsonError(request, "Invalid scanner filter. Choose Original, Black & White or Enhanced.", 400);
    }

    if (entries.length === 0) {
      return toolJsonError(request, "At least one image file is required", 400);
    }

    if (entries.length > SCANNER_MAX_IMAGES) {
      return toolJsonError(request, `Maximum ${SCANNER_MAX_IMAGES} images allowed for scanning`, 400);
    }
    if (!entries.every((entry): entry is File => entry instanceof File)) {
      return toolJsonError(request, "Only image files are accepted.", 400);
    }
    const files = entries;

    const imageBuffers: Buffer[] = [];
    for (const file of files) {
      const validated = await validateSingleUpload(file, ["image"], maxSizeMB);
      if (!validated.ok) {
        if (validated.error === "Invalid file type.") {
          return toolJsonError(request, `Invalid file type: ${file.name}. Only image files are accepted.`, 400);
        }
        return uploadValidationResponse(request, validated);
      }
      imageBuffers.push(validated.buffer);
    }

    // Avoid decoding ten large photos concurrently; retain their upload order.
    const processedImages: Buffer[] = [];
    try {
      for (const imageBuffer of imageBuffers) {
        processedImages.push(await prepareScannerImage(imageBuffer, filter));
      }
    } catch {
      return toolJsonError(request, "An image could not be read. Check that each file is a valid, supported image and try again.", 400);
    }

    const pdfBuffer = await jpgToPdf(processedImages, {
      pageSize: "a4",
      orientation: "portrait",
      margin: "small",
    });

    const processingTime = Date.now() - startTime;
    await logToolUsage({
      userId,
      sessionId: request.headers.get("x-session-id") || "anonymous",
      toolSlug: "pdf-scanner",
      ipAddress: clientIpForLogs(request),
      fileSize: files.reduce((sum, f) => sum + f.size, 0),
      processingTimeMs: processingTime,
      status: "completed",
      inputFileNames: files.map((f) => f.name),
      output: {
        buffer: pdfBuffer,
        fileName: "scanned-document.pdf",
        mimeType: "application/pdf",
      },
    }).catch(() => {});

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="scanned-document.pdf"',
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    return handleToolRouteFailure(error, { request, 
      toolSlug: "pdf-scanner",
      userId,
      errorType: "SCANNER_ERROR",
      fallbackMessage: "Failed to create scanned PDF",
    });
  }
}
