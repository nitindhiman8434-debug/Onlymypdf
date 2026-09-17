import { beginToolRoute, handleToolRouteFailure } from "@/lib/server/tool-request-guards";
import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { getPdfPageCountFromBuffer } from "@/lib/pdf/pdf-read.server";
import { validateSingleUpload, uploadValidationResponse } from "@/lib/server/upload-validation";
import { FILE_LIMITS } from "@/config/constants";
import { createClient } from "@/lib/supabase/server";
import { assertMfaAal2Satisfied } from "@/lib/auth/mfa-assurance";
import { assertAccountActive } from "@/lib/auth/account-status";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const early = await beginToolRoute(request, "pdf-meta");
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

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
    const totalPages = await getPdfPageCountFromBuffer(buffer);

    return NextResponse.json({ totalPages });
  } catch (error) {
    return handleToolRouteFailure(error, { request, 
      toolSlug: "pdf-meta",
      errorType: "META_ERROR",
      fallbackMessage: "Failed to read PDF",
    });
  }
}
