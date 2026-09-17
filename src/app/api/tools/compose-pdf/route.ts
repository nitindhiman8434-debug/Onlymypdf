import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { composePdfFromSlots } from "@/lib/services/pdf-compose.service";
import { buildPdfBuffersDownloadResponse } from "@/lib/pdf/pdf-buffers-response";
import { resolvePdfBuffer } from "@/lib/pdf/pdf-password.server";
import { resolvePdfBufferErrorResponse } from "@/lib/server/pdf-password-http";
import { splitPDF } from "@/lib/services/pdf-split.service";
import { parseComposeSlots } from "@/lib/api/compose-validation";
import { isValidFileType, validateFileSize } from "@/lib/utils/file";
import { validateBufferMagic } from "@/lib/utils/file-magic";
import { ownerHashFromRequest } from "@/lib/server/request-security";
import { beginToolRoute, handleToolRouteFailure } from "@/lib/server/tool-request-guards";
import { checkUsageLimit } from "@/lib/services/usage-limit.service";
import { resolveToolUserContext } from "@/lib/services/user-tool-context.service";
import { resolveMutationToolUser } from "@/lib/auth/tool-mutation-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const early = await beginToolRoute(request, "compose-pdf");
  if (early) return early;

  try {
    const mutationAuth = await resolveMutationToolUser(request);
    if (mutationAuth.denied) return mutationAuth.denied;
    const userId = mutationAuth.userId;

    const usageResult = await checkUsageLimit(userId, request, "compose-pdf");
    if (!usageResult.allowed) {
      return toolJsonError(request, usageResult.message ?? "Daily usage limit reached.", 429);
    }

    const userContext = await resolveToolUserContext(userId);
    const maxSizeMB = userContext.maxSizeMB;

    const ownerHash = ownerHashFromRequest(request, userId);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const slotsRaw = formData.get("slots") as string | null;
    const separate = formData.get("separate") === "true";

    if (!file || !slotsRaw) {
      return toolJsonError(request, "PDF file and slots are required", 400);
    }

    if (!isValidFileType(file, ["pdf"])) {
      return toolJsonError(request, "Only PDF files are accepted", 400);
    }

    const sizeCheck = validateFileSize(file, maxSizeMB);
    if (!sizeCheck.valid) {
      return toolJsonError(request, sizeCheck.message, 400);
    }

    const slots = parseComposeSlots(slotsRaw);
    if (!slots) {
      return toolJsonError(request, "Invalid or too many page slots.", 400);
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const magic = validateBufferMagic(rawBuffer, ["pdf"]);
    if (!magic.valid) {
      return toolJsonError(request, magic.message ?? "Invalid PDF file content.", 400);
    }

    const password = (formData.get("password") as string | null) || null;
    let buffer: Buffer;

    try {
      buffer = await resolvePdfBuffer(rawBuffer, password);
    } catch (err) {
      const passwordError = resolvePdfBufferErrorResponse(request, err, {
        fileName: file.name,
      });
      if (passwordError) return passwordError;
      const msg = err instanceof Error ? err.message : "Failed to open PDF";
      return toolJsonError(request, msg, 400);
    }
    const splitRangesRaw = formData.get("splitRanges") as string | null;

    if (splitRangesRaw) {
      const composed = await composePdfFromSlots(buffer, slots, ownerHash);
      const parsedRanges = splitRangesRaw.split(",").map((r: string) => {
        const [start, end] = r.trim().split("-").map(Number);
        return { start, end: end ?? start };
      });
      const results = await splitPDF(composed, parsedRanges);
      return buildPdfBuffersDownloadResponse(
        results,
        "split.pdf",
        "split-pages.zip",
        results.map((_, i) => `part-${i + 1}.pdf`)
      );
    }

    if (separate) {
      const results: Buffer[] = [];
      for (let i = 0; i < slots.length; i++) {
        results.push(await composePdfFromSlots(buffer, [slots[i]], ownerHash));
      }
      return buildPdfBuffersDownloadResponse(
        results,
        "extracted.pdf",
        "extracted-pages.zip",
        results.map((_, i) => `page-${i + 1}.pdf`)
      );
    }

    const result = await composePdfFromSlots(buffer, slots, ownerHash);

    return new NextResponse(new Uint8Array(result), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="extracted.pdf"',
      },
    });
  } catch (error) {
    return handleToolRouteFailure(error, { request, 
      toolSlug: "compose-pdf",
      errorType: "COMPOSE_ERROR",
      fallbackMessage: "Failed to compose PDF",
    });
  }
}
