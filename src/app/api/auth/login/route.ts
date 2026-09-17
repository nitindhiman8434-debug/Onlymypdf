import { NextRequest, NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  attachLocalDevSessionCookie,
  isLocalDevAuthEnabled,
  localDevSignIn,
} from "@/lib/auth/local-dev-auth";
import { isUserLoginBlocked, BLOCKED_LOGIN_MESSAGE } from "@/lib/auth/blocked-login";
import { checkLoginRateLimit, checkLoginEmailRateLimit, rateLimitResponse } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { toSafeApiError } from "@/lib/server/safe-error";
import { guardTurnstileRequest } from "@/lib/security/verify-turnstile-request";

export async function POST(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await checkLoginRateLimit(request);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);

    const { email, password, turnstileToken } = await request.json();

    const turnstileBlocked = await guardTurnstileRequest(request, turnstileToken);
    if (turnstileBlocked) return turnstileBlocked;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const emailRate = await checkLoginEmailRateLimit(request, email);
    if (!emailRate.allowed) return rateLimitResponse(emailRate.retryAfterSec);

    if (isLocalDevAuthEnabled()) {
      const user = await localDevSignIn({ email, password });
      const response = NextResponse.json({
        user,
        session: { mode: "local-dev" },
      });
      return attachLocalDevSessionCookie(response, user.id);
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          error:
            "Login is not available yet. Add your Supabase URL and anon key in .env.local, then restart the server.",
        },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (data.user && (await isUserLoginBlocked(data.user.id))) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: BLOCKED_LOGIN_MESSAGE }, { status: 403 });
    }

    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const totpFactor = factorsData?.totp?.find((f) => f.status === "verified");

    if (totpFactor && data.session) {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });
      if (challengeError || !challenge) {
        await supabase.auth.signOut();
        return NextResponse.json(
          {
            error:
              "Multi-factor authentication is temporarily unavailable. Please try again later.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({
        requiresMfa: true,
        factorId: totpFactor.id,
        challengeId: challenge.id,
      });
    }

    return NextResponse.json({
      user: data.user ? { id: data.user.id, email: data.user.email } : null,
      success: true,
    });
  } catch (err) {
    return NextResponse.json({ error: toSafeApiError(err) }, { status: 401 });
  }
}
