import { guardToolRateLimit, checkRateLimit, rateLimitResponse } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { toSafeApiError } from "@/lib/server/safe-error";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import {
  exportSummary,
  getSummaryExportFilename,
  type SummaryExportFormat,
} from "@/lib/services/summary-export.service";

const ALLOWED_FORMATS: SummaryExportFormat[] = ["txt", "docx", "pdf"];

export async function POST(request: NextRequest) {
  const originBlocked = guardMutationOrigin(request);
  if (originBlocked) return originBlocked;

  const rateLimited = await guardToolRateLimit(request, "ai-pdf-summarizer");
  if (rateLimited) return rateLimited;

  try {
    const auth = await tryGetApiUser();
    if (!auth.ok) {
      return auth.response.status === 401
        ? toolJsonError(
            request,
            "Authentication required. Please sign in to download summaries.",
            401
          )
        : auth.response;
    }

    // Per-user cap: export runs Puppeteer/docx generation, so bound it beyond
    // the IP rate limit to prevent a single account driving compute cost abuse.
    const exportRate = await checkRateLimit(request, {
      keyPrefix: "ai-export",
      keySuffix: auth.user.id,
      maxRequests: 40,
      windowMs: 60 * 60 * 1000,
    });
    if (!exportRate.allowed) return rateLimitResponse(exportRate.retryAfterSec);

    const body = await request.json();
    const format = body.format as SummaryExportFormat;
    const summary = body.summary;

    if (!format || !ALLOWED_FORMATS.includes(format)) {
      return toolJsonError(request, "Invalid format. Use txt, docx, or pdf.", 400);
    }

    if (!summary?.shortSummary) {
      return toolJsonError(request, "Summary data is required.", 400);
    }

    const { buffer, mimeType } = await exportSummary(summary, format);
    const filename = getSummaryExportFilename(summary, format);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Summary export error:", error);
    return toolJsonError(
      request,
      toSafeApiError(error, "Failed to export summary."),
      500
    );
  }
}
