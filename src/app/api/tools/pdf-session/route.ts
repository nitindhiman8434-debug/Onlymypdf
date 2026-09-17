import { beginToolRoute, guardToolUsageLimit, handleToolRouteFailure } from "@/lib/server/tool-request-guards";
import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { createPdfSession } from "@/lib/pdf/pdf-session-store";
import { ownerHashFromRequest } from "@/lib/server/request-security";
import { validateSingleUpload, uploadValidationResponse } from "@/lib/server/upload-validation";
import { FILE_LIMITS } from "@/config/constants";
import { createClient } from "@/lib/supabase/server";
import { assertMfaAal2Satisfied } from "@/lib/auth/mfa-assurance";
import { assertAccountActive } from "@/lib/auth/account-status";
import { probePdfAccess } from "@/lib/pdf/pdf-password.server";
import { unlockPDF } from "@/lib/services/pdf-security.service";
import {
  toolWrongPasswordError,
} from "@/lib/server/pdf-password-http";

export const runtime = "nodejs";
export const maxDuration = 60;

const WRONG_PASSWORD_MSG = "Incorrect password. Please try again.";

export async function POST(request: NextRequest) {
  const early = await beginToolRoute(request, "pdf-session");
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

    const usageBlocked = await guardToolUsageLimit(request, "pdf-session", user?.id ?? null);
    if (usageBlocked) return usageBlocked;

    const ownerHash = ownerHashFromRequest(request, user?.id ?? null);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const password = (formData.get("password") as string | null) || null;

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

    let buffer = validated.buffer;
    const withoutPassword = await probePdfAccess(buffer);

    if (withoutPassword.status === "unreadable") {
      return toolJsonError(request, withoutPassword.message, 400);
    }

    let totalPages = withoutPassword.status === "ok" ? withoutPassword.pages : 0;

    if (withoutPassword.status === "password_required") {
      if (!password) {
        return toolJsonError(request, "This PDF is password-protected.", 400, {
          code: "password_required",
          fileName: file.name,
        });
      }

      const withPassword = await probePdfAccess(buffer, password);
      if (withPassword.status === "wrong_password") {
        return toolJsonError(request, WRONG_PASSWORD_MSG, 400, {
          code: "wrong_password",
          fileName: file.name,
        });
      }
      if (withPassword.status !== "ok") {
        return toolWrongPasswordError(
          request,
          withPassword.status === "unreadable" ? withPassword.message : WRONG_PASSWORD_MSG,
          file.name
        );
      }

      try {
        buffer = Buffer.from(await unlockPDF(buffer, password));
        const unlocked = await probePdfAccess(buffer);
        if (unlocked.status === "ok") {
          totalPages = unlocked.pages;
        } else {
          totalPages = withPassword.pages;
        }
      } catch (unlockErr) {
        const msg = unlockErr instanceof Error ? unlockErr.message : WRONG_PASSWORD_MSG;
        return toolWrongPasswordError(
          request,
          msg.includes("Incorrect password") ? msg : WRONG_PASSWORD_MSG,
          file.name
        );
      }
    }

    if (totalPages === 0) {
      return toolJsonError(request, "Could not read this PDF.", 400);
    }

    const sessionId = await createPdfSession(buffer, ownerHash);

    return NextResponse.json({
      sessionId,
      totalPages,
      truncated: totalPages > 500,
    });
  } catch (error) {
    return handleToolRouteFailure(error, { request, 
      toolSlug: "pdf-session",
      errorType: "SESSION_ERROR",
      fallbackMessage: "Failed to open PDF",
    });
  }
}
