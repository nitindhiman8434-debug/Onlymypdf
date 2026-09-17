import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getLocalDevSessionUser,
  isLocalDevAuthEnabled,
} from "@/lib/auth/local-dev-auth";
import { getUserProfile } from "@/lib/db/queries";
import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";
import { resolveMfaAssurance } from "@/lib/auth/mfa-assurance";
import { authGuardResponse } from "@/lib/server/auth-guard-http";
import { isBlockedProfile } from "@/lib/auth/plan-access";
import { BLOCKED_LOGIN_MESSAGE } from "@/lib/auth/blocked-login";

export async function GET(request: NextRequest) {
  const rateLimited = await guardGeneralApiRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    if (isLocalDevAuthEnabled()) {
      const user = await getLocalDevSessionUser();
      if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          plan: user.plan,
          full_name: user.full_name,
        },
      });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const assurance = await resolveMfaAssurance(supabase);
    if (assurance.requiresMfaVerification) {
      return NextResponse.json(
        { error: "Multi-factor authentication verification required", code: "MFA_REQUIRED" },
        { status: 403 }
      );
    }

    let profile = null;
    try {
      profile = await getUserProfile(user.id);
    } catch {
      // Profile may not exist yet for new users
    }

    if (profile && isBlockedProfile(profile)) {
      return NextResponse.json(
        { error: BLOCKED_LOGIN_MESSAGE, code: "ACCOUNT_BLOCKED" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email ?? "",
        role: profile?.role ?? "user",
        plan: profile?.plan ?? "free",
        full_name: profile?.full_name ?? null,
      },
    });
  } catch (err) {
    const guarded = authGuardResponse(err);
    if (guarded) return guarded;
    console.error("Auth me error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
