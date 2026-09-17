import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { PDFParse } from "pdf-parse";
import { summarizePDF } from "@/lib/services/ai-summary.service";
import { checkAIUsageLimit } from "@/lib/services/usage-limit.service";
import { logToolUsage, logError } from "@/lib/db/queries";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { validateSingleUpload, uploadValidationResponse } from "@/lib/server/upload-validation";
import { isAIProviderConfigured } from "@/lib/ai/config";
import { clientIpForLogs } from "@/lib/server/request-security";
import { beginToolRoute } from "@/lib/server/tool-request-guards";
import { resolveToolUserContext } from "@/lib/services/user-tool-context.service";
import { toSafeApiError, captureApiError } from "@/lib/server/safe-error";
import { toolPasswordRequiredError } from "@/lib/server/pdf-password-http";

export const maxDuration = 120;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Failed to summarize PDF";
}

async function extractPdfText(buffer: Buffer, password?: string): Promise<{
  textContent: string;
  pageCount: number;
}> {
  const parser = new PDFParse({
    data: buffer,
    password: password || undefined,
  });

  try {
    const parsed = await parser.getText();
    return {
      textContent: parsed.text,
      pageCount: parsed.total,
    };
  } finally {
    await parser.destroy();
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | null = null;

  try {
    const early = await beginToolRoute(request, "ai-pdf-summarizer");
    if (early) return early;

    const auth = await tryGetApiUser();
    if (!auth.ok) {
      return auth.response.status === 401
        ? NextResponse.json(
            { error: "Authentication required. Please sign in to use AI features." },
            { status: 401 }
          )
        : auth.response;
    }
    const user = auth.user;

    userId = user.id;

    const usageLimit = await checkAIUsageLimit(userId, user.plan);
    if (!usageLimit.allowed) {
      return toolJsonError(request, usageLimit.message || "Daily AI usage limit reached.", 429);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const requestedProvider = (formData.get("provider") as string) || "gemini";
    const provider: "gemini" | "openai" =
      requestedProvider === "openai" ? "openai" : "gemini";
    const pdfPassword = (formData.get("password") as string | null)?.trim() || undefined;

    if (!file) {
      return toolJsonError(request, "PDF file is required", 400);
    }

    const userContext = await resolveToolUserContext(userId);
    const maxSizeMB = userContext.maxSizeMB;

    const validated = await validateSingleUpload(file, ["pdf"], maxSizeMB);
    if (!validated.ok) {
      if (validated.error === "Invalid file type.") {
        return toolJsonError(request, "Invalid file type. Only PDF files are accepted.", 400);
      }
      return uploadValidationResponse(request, validated);
    }

    const buffer = validated.buffer;

    let textContent = "";
    let pageCount = 0;

    try {
      const extracted = await extractPdfText(buffer, pdfPassword);
      textContent = extracted.textContent;
      pageCount = extracted.pageCount;
    } catch (error) {
      const message = getErrorMessage(error).toLowerCase();

      if (message.includes("password")) {
        return toolPasswordRequiredError(
          request,
          "This PDF is password-protected. Unlock it first using the Unlock PDF tool, or enter the PDF password and try again.",
          file.name
        );
      }

      throw error;
    }

    if (!textContent || textContent.trim().length < 50) {
      return toolJsonError(
        request,
        "Could not extract enough text from this PDF. The file may be image-based, scanned, or empty.",
        400
      );
    }

    const summary = await summarizePDF(textContent, userId, provider);

    const processingTime = Date.now() - startTime;
    const usedLocalSummary = !isAIProviderConfigured(provider);

    await logToolUsage({
      userId,
      sessionId: request.headers.get("x-session-id") || "anonymous",
      toolSlug: "ai-pdf-summarizer",
      ipAddress: clientIpForLogs(request),
      fileSize: buffer.length,
      processingTimeMs: processingTime,
      status: "completed",
    }).catch(() => {});

    return NextResponse.json({
      documentTitle: summary.documentTitle,
      topics: summary.topics ?? [],
      shortSummary: summary.shortSummary,
      detailedSummary: summary.detailedSummary,
      keyPoints: summary.keyPoints,
      actionItems: summary.actionItems,
      importantDates: summary.importantDates,
      metadata: {
        pageCount,
        characterCount: textContent.length,
        processingTimeMs: processingTime,
        mode: usedLocalSummary ? "local-fallback" : provider,
      },
    });
  } catch (error) {
    const message = getErrorMessage(error);

    await logError({
      user_id: userId,
      tool_name: "ai-pdf-summarizer",
      error_type: "AI_SUMMARY_ERROR",
      error_message: message,
      stack_trace: error instanceof Error ? error.stack : undefined,
    }).catch(() => {});

    if (message.includes("usage limit") || message.includes("limit reached")) {
      return toolJsonError(request, message, 429);
    }

    if (
      message.includes("API key") ||
      message.includes("quota") ||
      message.includes("GEMINI_API_KEY") ||
      message.includes("OPENAI_API_KEY")
    ) {
      return toolJsonError(
        request,
        "AI summarization is temporarily unavailable. Please try again later.",
        503
      );
    }

    captureApiError(error, { route: "ai/summarize", user_id: userId });
    return toolJsonError(
      request,
      toSafeApiError(error, "AI summarization failed. Please try again."),
      500
    );
  }
}
