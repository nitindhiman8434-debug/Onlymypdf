import { beginToolRoute, guardToolUsageLimit, handleToolRouteFailure } from "@/lib/server/tool-request-guards";
import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { renderPdfThumbnailsServer } from "@/lib/pdf/pdf-thumbnails.server";
import { validateSingleUpload, uploadValidationResponse } from "@/lib/server/upload-validation";
import { FILE_LIMITS } from "@/config/constants";
import { createClient } from "@/lib/supabase/server";
import { assertMfaAal2Satisfied } from "@/lib/auth/mfa-assurance";
import { assertAccountActive } from "@/lib/auth/account-status";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const early = await beginToolRoute(request, "pdf-previews");
  if (early) return early;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await assertMfaAal2Satisfied(supabase);
      await assertAccountActive(user.id);
    }

    const usageBlocked = await guardToolUsageLimit(request, "pdf-previews", user?.id ?? null);
    if (usageBlocked) return usageBlocked;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const startPage = Math.max(1, parseInt(String(formData.get("startPage") ?? "1"), 10) || 1);
    const endPage = Math.max(
      startPage,
      parseInt(String(formData.get("endPage") ?? "0"), 10) || 0
    );
    const maxPages = Math.min(
      60,
      Math.max(1, parseInt(String(formData.get("maxPages") ?? "60"), 10) || 60)
    );

    if (!file) {
      return toolJsonError(request, "PDF file is required", 400);
    }

    const validated = await validateSingleUpload(file, ["pdf"], FILE_LIMITS.maxFreeFileSizeMB);
    if (!validated.ok) {
      if (validated.error === "Invalid file type.") {
        return toolJsonError(request, "Only PDF files are accepted", 400);
      }
      return uploadValidationResponse(request, validated);
    }

    const buffer = validated.buffer;
    const result = await renderPdfThumbnailsServer(buffer, {
      startPage,
      endPage: endPage > 0 ? endPage : undefined,
      maxPages,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleToolRouteFailure(error, { request, 
      toolSlug: "pdf-previews",
      errorType: "PREVIEW_ERROR",
      fallbackMessage: "Failed to render previews",
    });
  }
}
