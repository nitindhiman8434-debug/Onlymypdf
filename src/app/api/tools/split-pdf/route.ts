import { beginToolRoute, handleToolRouteFailure } from "@/lib/server/tool-request-guards";
import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { splitPDF, splitAllPages, extractPages } from "@/lib/services/pdf-split.service";
import { buildPdfBuffersDownloadResponse } from "@/lib/pdf/pdf-buffers-response";
import { buildZip } from "@/lib/services/zip-builder";
import { resolvePdfBuffer } from "@/lib/pdf/pdf-password.server";
import { resolvePdfBufferErrorResponse } from "@/lib/server/pdf-password-http";
import { checkUsageLimit, checkFileSizeLimit } from "@/lib/services/usage-limit.service";
import { logToolUsage } from "@/lib/db/queries";
import { resolveMutationToolUser } from "@/lib/auth/tool-mutation-auth";
import { validateSingleUpload, uploadValidationResponse } from "@/lib/server/upload-validation";
import { FILE_LIMITS } from "@/config/constants";
import { clientIpForLogs } from "@/lib/server/request-security";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const early = await beginToolRoute(request, "split-pdf");
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

    const usageResult = await checkUsageLimit(userId, request, "split-pdf");
    if (!usageResult.allowed) {
      return toolJsonError(request, usageResult.message ?? "Daily usage limit reached.", 429);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as string) || "all";
    const ranges = formData.get("ranges") as string | null;
    const pages = formData.get("pages") as string | null;

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

    const password = (formData.get("password") as string | null) || null;
    let buffer: Buffer;

    try {
      buffer = await resolvePdfBuffer(validated.buffer, password);
    } catch (err) {
      const passwordError = resolvePdfBufferErrorResponse(request, err, {
        fileName: file.name,
      });
      if (passwordError) return passwordError;
      const msg = err instanceof Error ? err.message : "Failed to open PDF";
      return toolJsonError(request, msg, 400);
    }

    let result: Buffer | Buffer[];
    let filename = "split.pdf";

    switch (mode) {
      case "all":
        result = await splitAllPages(buffer);
        break;
      case "range":
        if (!ranges) {
          return toolJsonError(
            request,
            "Ranges are required for range split mode (e.g., 1-3, 5-7).",
            400
          );
        }
        {
          const parsedRanges = ranges.split(",").map((r: string) => {
            const [start, end] = r.trim().split("-").map(Number);
            return { start, end: end ?? start };
          });
          result = await splitPDF(buffer, parsedRanges);
        }
        break;
      case "extract":
        if (!pages) {
          return toolJsonError(
            request,
            "Page numbers are required for extract mode (e.g., 1, 3, 5).",
            400
          );
        }
        const pageNumbers = pages.split(",").map((p) => parseInt(p.trim(), 10));
        if (pageNumbers.some(isNaN)) {
          return toolJsonError(request, "Invalid page numbers", 400);
        }
        result = await extractPages(buffer, pageNumbers);
        filename = "extracted.pdf";
        break;
      default:
        return toolJsonError(request, "Invalid split mode", 400);
    }

    const processingTime = Date.now() - startTime;

    if (Array.isArray(result)) {
      const rangeParts =
        mode === "range" && ranges
          ? ranges.split(",").map((r) => r.trim())
          : [];
      const zipEntryNames = result.map((_, index) => {
        const label = rangeParts[index] ?? String(index + 1);
        const safeName = label.replace(/[^0-9,-]/g, "") || String(index + 1);
        return `page-${safeName}.pdf`;
      });

      let outputBuffer: Buffer;
      let outputFileName: string;
      let mimeType: string;

      if (result.length === 1) {
        outputBuffer = result[0];
        outputFileName = "split.pdf";
        mimeType = "application/pdf";
      } else {
        const filesMap: Record<string, Buffer> = {};
        result.forEach((buffer, index) => {
          const name = zipEntryNames[index] ?? `part-${index + 1}.pdf`;
          filesMap[name] = buffer;
        });
        outputBuffer = await buildZip(filesMap);
        outputFileName = "split-pages.zip";
        mimeType = "application/zip";
      }

      await logToolUsage({
        userId,
        sessionId: request.headers.get("x-session-id") || "anonymous",
        toolSlug: "split-pdf",
        ipAddress: clientIpForLogs(request),
        fileSize: buffer.length,
        processingTimeMs: processingTime,
        status: "completed",
        inputFileNames: [file.name],
        output: {
          buffer: outputBuffer,
          fileName: outputFileName,
          mimeType,
        },
      }).catch(() => {});

      return buildPdfBuffersDownloadResponse(
        result,
        "split.pdf",
        "split-pages.zip",
        zipEntryNames
      );
    }

    await logToolUsage({
      userId,
      sessionId: request.headers.get("x-session-id") || "anonymous",
      toolSlug: "split-pdf",
      ipAddress: clientIpForLogs(request),
      fileSize: buffer.length,
      processingTimeMs: processingTime,
      status: "completed",
      inputFileNames: [file.name],
      output: {
        buffer: result,
        fileName: filename,
        mimeType: "application/pdf",
      },
    }).catch(() => {});

    return new NextResponse(new Uint8Array(result), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(result.length),
      },
    });
  } catch (error) {
    return handleToolRouteFailure(error, { request, 
      toolSlug: "split-pdf",
      userId,
      errorType: "SPLIT_ERROR",
      fallbackMessage: "Failed to split PDF",
    });
  }
}
