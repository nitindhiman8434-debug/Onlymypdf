import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  getLocalDevSessionUser,
  isLocalDevAuthEnabled,
} from "@/lib/auth/local-dev-auth";
import {
  getLocalDevDailyUsage,
  getLocalDevTotalProcessed,
  isLocalDevActivityEnabled,
} from "@/lib/auth/local-dev-activity";
import { buildSessionPayload, buildSessionPayloadForUser } from "@/lib/auth/session-payload";
import {
  resolveMfaAssurance,
  MfaAssuranceUnavailableError,
} from "@/lib/auth/mfa-assurance";
import { isBlockedProfile } from "@/lib/auth/plan-access";
import { BLOCKED_LOGIN_MESSAGE } from "@/lib/auth/blocked-login";

/** Session bootstrap — higher limit than general API (header auth sync). */
async function guardSessionRateLimit(request: NextRequest): Promise<Response | null> {
  const { checkRateLimit, rateLimitResponse } = await import("@/lib/server/rate-limiter");
  const rate = await checkRateLimit(request, {
    keyPrefix: "auth-session",
    maxRequests: 300,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);
  return null;
}

export async function GET(request: NextRequest) {
  const rateLimited = await guardSessionRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    if (isLocalDevAuthEnabled()) {
      const user = await getLocalDevSessionUser();
      if (!user) {
        return NextResponse.json({ user: null, profile: null });
      }

      const [totalProcessed, aiUsedToday] = isLocalDevActivityEnabled()
        ? await Promise.all([
            getLocalDevTotalProcessed(user.id),
            getLocalDevDailyUsage(user.id, "ai-pdf-summarizer"),
          ])
        : [0, 0];

      return NextResponse.json(
        buildSessionPayload(
          {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
          },
          {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            plan: user.plan,
            plan_expires_at: null,
            total_files_processed: totalProcessed,
            ai_credits_used: aiUsedToday,
            is_blocked: false,
          }
        )
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ user: null, profile: null });
    }

    const serviceClient = await createServiceClient();
    const { data: profile, error: profileError } = await serviceClient
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }

    if (profile && isBlockedProfile(profile as { is_blocked?: boolean | null })) {
      return NextResponse.json(
        { error: BLOCKED_LOGIN_MESSAGE, code: "ACCOUNT_BLOCKED" },
        { status: 403 }
      );
    }

    const assurance = await resolveMfaAssurance(supabase);

    const payload = await buildSessionPayloadForUser(
      {
        id: user.id,
        email: user.email ?? "",
        created_at: user.created_at,
      },
      profile as Parameters<typeof buildSessionPayload>[1]
    );

    if (assurance.requiresMfaVerification) {
      return NextResponse.json({
        user: null,
        profile: null,
        requiresMfa: true,
      });
    }

    return NextResponse.json({
      ...payload,
      requiresMfa: false,
    });
  } catch (err) {
    if (err instanceof MfaAssuranceUnavailableError) {
      return NextResponse.json(
        { error: err.message, code: "MFA_ASSURANCE_UNAVAILABLE" },
        { status: 503 }
      );
    }
    console.error("Session error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
