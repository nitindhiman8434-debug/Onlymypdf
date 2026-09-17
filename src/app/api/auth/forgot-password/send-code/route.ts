import { NextRequest, NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  isLocalDevAuthEnabled,
  localDevCreateResetCode,
} from "@/lib/auth/local-dev-auth";
import { sendPasswordResetCode } from "@/lib/auth/password-reset-mailer";
import {
  checkPasswordResetEmailRateLimit,
  checkPasswordResetRateLimit,
  rateLimitResponse,
} from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { toSafeApiError } from "@/lib/server/safe-error";
import { APP_URL } from "@/config/constants";
import { guardTurnstileRequest } from "@/lib/security/verify-turnstile-request";

export async function POST(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await checkPasswordResetRateLimit(request);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);

    const { email, turnstileToken } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailRate = await checkPasswordResetEmailRateLimit(request, email);
    if (!emailRate.allowed) return rateLimitResponse(emailRate.retryAfterSec);

    const turnstileBlocked = await guardTurnstileRequest(request, turnstileToken);
    if (turnstileBlocked) return turnstileBlocked;

    if (isLocalDevAuthEnabled()) {
      const code = await localDevCreateResetCode(email);
      const delivery = await sendPasswordResetCode(email.trim().toLowerCase(), code);

      const body: Record<string, string> = {
        message: "Verification code sent to your email.",
        step: "verify-code",
        mode: "local-dev",
      };
      if (delivery.devCode) {
        body.devCode = delivery.devCode;
      }

      return NextResponse.json(body);
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          error:
            "Password reset is not available yet. Add your Supabase URL and anon key in .env.local, then restart the server.",
        },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${APP_URL}/auth/callback?next=/reset-password`,
    });

    if (error) {
      console.error("[forgot-password] reset email request failed:", error.message);
    }

    return NextResponse.json({
      message: "If an account exists for this email, a reset link has been sent.",
      step: "check-email",
      mode: "supabase",
    });
  } catch (err) {
    return NextResponse.json(
      { error: toSafeApiError(err, "Could not send reset email") },
      { status: 400 }
    );
  }
}
