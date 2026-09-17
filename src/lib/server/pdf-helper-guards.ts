import type { NextRequest } from "next/server";
import { assertMfaAal2Satisfied } from "@/lib/auth/mfa-assurance";
import { assertAccountActive } from "@/lib/auth/account-status";
import { createClient } from "@/lib/supabase/server";
import { guardPdfHelperRateLimit, guardPdfThumbRateLimit } from "@/lib/server/rate-limiter";
import { guardToolMutationOrigin } from "@/lib/server/mutation-origin";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { authGuardResponse } from "@/lib/server/auth-guard-http";

/**
 * CSRF + rate limit + MFA for PDF preview helper routes (thumbnails, page count,
 * session, text blocks). These are PREVIEW operations, not billable
 * conversions, so they intentionally do NOT consume the daily usage quota —
 * otherwise opening one multi-page PDF would exhaust a user's daily limit.
 */
export async function beginPdfHelperRoute(
  request: NextRequest,
  _toolSlug: string,
  options?: { thumbRead?: boolean }
): Promise<Response | null> {
  const originBlocked = guardToolMutationOrigin(request);
  if (originBlocked) {
    return toolJsonError(request, "Invalid request origin", 403);
  }

  const rateLimited = options?.thumbRead
    ? await guardPdfThumbRateLimit(request)
    : await guardPdfHelperRateLimit(request);
  if (rateLimited) return rateLimited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    try {
      await assertMfaAal2Satisfied(supabase);
      await assertAccountActive(user.id);
    } catch (error) {
      const guarded = authGuardResponse(error);
      if (guarded) return guarded;
      throw error;
    }
  }

  return null;
}
