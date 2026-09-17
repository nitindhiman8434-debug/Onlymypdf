import { NextRequest, NextResponse } from "next/server";
import { isLocalDevAuthEnabled, localDevVerifyResetCode } from "@/lib/auth/local-dev-auth";
import { checkAuthRateLimit, rateLimitResponse } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { toSafeApiError } from "@/lib/server/safe-error";
import { APP_URL } from "@/config/constants";

export async function POST(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await checkAuthRateLimit(request);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);

    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code are required" },
        { status: 400 }
      );
    }

    if (!isLocalDevAuthEnabled()) {
      return NextResponse.json(
        { error: "Code verification is only used in local development mode." },
        { status: 400 }
      );
    }

    const { resetToken } = await localDevVerifyResetCode({ email, code });
    const resetUrl = `${APP_URL}/reset-password#token=${encodeURIComponent(resetToken)}`;

    return NextResponse.json({
      message: "Code verified. Use the reset link to choose a new password.",
      resetUrl,
      resetToken,
    });
  } catch (err) {
    return NextResponse.json(
      { error: toSafeApiError(err, "Verification failed") },
      { status: 400 }
    );
  }
}
