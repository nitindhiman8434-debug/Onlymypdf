import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { authGuardResponse } from "@/lib/server/auth-guard-http";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { checkAuthRateLimit, checkMfaVerifyRateLimit, rateLimitResponse } from "@/lib/server/rate-limiter";
import { toSafeApiError } from "@/lib/server/safe-error";
import { guardTurnstileRequest } from "@/lib/security/verify-turnstile-request";

export async function POST(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await checkAuthRateLimit(request);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);

    const body = await request.json();
    const { factorId, challengeId, code, mode, turnstileToken } = body as {
      factorId?: string;
      challengeId?: string;
      code?: string;
      mode?: "enroll" | "login";
      turnstileToken?: string;
    };

    if (!factorId || !code) {
      return NextResponse.json({ error: "factorId and code are required" }, { status: 400 });
    }

    const mfaRate = await checkMfaVerifyRateLimit(request, factorId);
    if (!mfaRate.allowed) return rateLimitResponse(mfaRate.retryAfterSec);

    const supabase = await createClient();

    if (mode === "login") {
      // Unauthenticated MFA step — add bot protection on top of the per-factor limit.
      const turnstileBlocked = await guardTurnstileRequest(request, turnstileToken);
      if (turnstileBlocked) return turnstileBlocked;

      if (!challengeId) {
        return NextResponse.json({ error: "challengeId is required for login MFA" }, { status: 400 });
      }
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });
      if (error) {
        return NextResponse.json({ error: "Invalid verification code." }, { status: 401 });
      }
      return NextResponse.json({ success: true });
    }

    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError || !challenge) {
      return NextResponse.json({ error: "MFA challenge failed. Please try again." }, { status: 400 });
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      return NextResponse.json({ error: "Invalid verification code." }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const guarded = authGuardResponse(err);
    if (guarded) return guarded;
    return NextResponse.json({ error: toSafeApiError(err, "MFA verification failed") }, { status: 500 });
  }
}
