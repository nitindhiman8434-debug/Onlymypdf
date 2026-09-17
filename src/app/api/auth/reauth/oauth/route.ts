import { NextRequest, NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { APP_URL } from "@/config/constants";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { checkAuthRateLimit, rateLimitResponse } from "@/lib/server/rate-limiter";
import { isStepUpPurpose, type StepUpPurpose, buildStepUpInitToken } from "@/lib/auth/step-up-auth";
import { resolveSafeNextPath } from "@/lib/auth/safe-redirect";
import { resolveUserAuthMethods, type OAuthProvider } from "@/lib/auth/user-auth-methods";
import { toSafeApiError } from "@/lib/server/safe-error";

const PURPOSE_REDIRECT: Record<StepUpPurpose, string> = {
  export: "/dashboard/settings",
  delete: "/dashboard/settings",
  mfa_enroll: "/dashboard/security",
};

const ALLOWED_PROVIDERS = new Set<OAuthProvider>(["google", "github", "azure"]);

export async function POST(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await checkAuthRateLimit(request);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "OAuth re-authentication requires Supabase to be configured." },
        { status: 503 }
      );
    }

    const auth = await tryGetApiUser({ skipMfaAssurance: true });
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const purpose = typeof body.purpose === "string" ? body.purpose : "";
    if (!isStepUpPurpose(purpose)) {
      return NextResponse.json({ error: "Invalid step-up purpose." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const methods = resolveUserAuthMethods(user.identities);
    const requestedProvider =
      typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";
    const provider = ALLOWED_PROVIDERS.has(requestedProvider as OAuthProvider)
      ? (requestedProvider as OAuthProvider)
      : methods.oauthProviders[0];

    if (!provider) {
      return NextResponse.json(
        { error: "No linked OAuth provider is available for this account." },
        { status: 400 }
      );
    }

    const nextPath = resolveSafeNextPath(
      typeof body.redirectTo === "string" ? body.redirectTo : null,
      PURPOSE_REDIRECT[purpose]
    );
    const appUrl = APP_URL.replace(/\/$/, "");
    const initToken = buildStepUpInitToken(user.id, purpose);
    const redirectTo = `${appUrl}/auth/callback?reauth=${encodeURIComponent(purpose)}&stepUpInit=${encodeURIComponent(initToken)}&next=${encodeURIComponent(nextPath)}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { prompt: "login" },
      },
    });

    if (error || !data.url) {
      return NextResponse.json(
        { error: error?.message ?? "Could not start identity confirmation." },
        { status: 400 }
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (err) {
    return NextResponse.json(
      { error: toSafeApiError(err, "OAuth re-authentication failed") },
      { status: 500 }
    );
  }
}
