import { NextRequest, NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  attachLocalDevSessionCookie,
  isLocalDevAuthEnabled,
  localDevSignUp,
} from "@/lib/auth/local-dev-auth";
import { checkAuthRateLimit, checkSignupEmailRateLimit, rateLimitResponse } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { toSafeApiError, captureApiError } from "@/lib/server/safe-error";
import { TERMS_CONSENT_VERSION } from "@/lib/privacy/consent";
import { logConsentRecord } from "@/lib/db/queries";
import { getGuestUsageKey } from "@/lib/server/client-ip";
import { guardTurnstileRequest } from "@/lib/security/verify-turnstile-request";

export async function POST(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await checkAuthRateLimit(request);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);

    const { email, password, fullName, termsAccepted, turnstileToken } = await request.json();

    const turnstileBlocked = await guardTurnstileRequest(request, turnstileToken);
    if (turnstileBlocked) return turnstileBlocked;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const emailRate = await checkSignupEmailRateLimit(request, email);
    if (!emailRate.allowed) return rateLimitResponse(emailRate.retryAfterSec);

    if (!termsAccepted) {
      return NextResponse.json(
        { error: "You must agree to the Terms of Service and Privacy Policy." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (isLocalDevAuthEnabled()) {
      const user = await localDevSignUp({ email, password, fullName });
      await logConsentRecord({
        user_id: user.id,
        consent_version: TERMS_CONSENT_VERSION,
        essential: true,
        analytics: false,
        marketing: false,
        ip_hash: getGuestUsageKey(request),
        user_agent: request.headers.get("user-agent"),
      });
      const response = NextResponse.json({
        user,
        session: { mode: "local-dev" },
        needsEmailConfirmation: false,
        message: "Account created successfully (local development mode).",
      });
      return attachLocalDevSessionCookie(response, user.id);
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          error:
            "Signup is not available yet. Add your Supabase URL and anon key in .env.local, then restart the server.",
        },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName || "" },
      },
    });

    if (error) {
      console.error("[signup] Supabase signUp failed:", error.message);
      return NextResponse.json({
        message:
          "If this email is not already registered, please check your inbox to confirm your account.",
        needsEmailConfirmation: true,
      });
    }

    if (data.user?.id) {
      await logConsentRecord({
        user_id: data.user.id,
        consent_version: TERMS_CONSENT_VERSION,
        essential: true,
        analytics: false,
        marketing: false,
        ip_hash: getGuestUsageKey(request),
        user_agent: request.headers.get("user-agent"),
      });
    }

    return NextResponse.json({
      user: data.user ? { id: data.user.id, email: data.user.email } : null,
      needsEmailConfirmation: !data.session,
      message: data.session
        ? "Account created successfully"
        : "Account created. Please check your email to confirm your account.",
    });
  } catch (err) {
    captureApiError(err, { route: "auth/signup" });
    const message = toSafeApiError(err, "Signup failed. Please try again.");
    console.error("Signup error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
