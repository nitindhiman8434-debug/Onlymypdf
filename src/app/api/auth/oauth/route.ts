import { NextRequest, NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { APP_URL } from "@/config/constants";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { checkAuthRateLimit, rateLimitResponse } from "@/lib/server/rate-limiter";
import { resolveSafeNextPath } from "@/lib/auth/safe-redirect";
import { toSafeApiError } from "@/lib/server/safe-error";
import { guardTurnstileRequest } from "@/lib/security/verify-turnstile-request";

const ALLOWED_PROVIDERS = ["google", "github", "azure"] as const;
type OAuthProvider = (typeof ALLOWED_PROVIDERS)[number];

function isAllowedProvider(value: string): value is OAuthProvider {
  return (ALLOWED_PROVIDERS as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await checkAuthRateLimit(request);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Sign-in with Google/GitHub requires Supabase to be configured." },
        { status: 503 }
      );
    }

    const { provider, redirectTo, turnstileToken } = (await request.json()) as {
      provider?: string;
      redirectTo?: string;
      turnstileToken?: string;
    };

    const turnstileBlocked = await guardTurnstileRequest(request, turnstileToken);
    if (turnstileBlocked) return turnstileBlocked;

    if (!provider || !isAllowedProvider(provider)) {
      return NextResponse.json({ error: "Invalid OAuth provider" }, { status: 400 });
    }

    const appUrl = APP_URL.replace(/\/$/, "");
    const safeNext = redirectTo ? resolveSafeNextPath(redirectTo) : null;
    const callbackUrl = safeNext
      ? `${appUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`
      : `${appUrl}/auth/callback`;

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      return NextResponse.json(
        { error: "Could not start OAuth sign-in. Please try again." },
        { status: 400 }
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (err) {
    return NextResponse.json(
      { error: toSafeApiError(err, "OAuth sign-in failed") },
      { status: 500 }
    );
  }
}
