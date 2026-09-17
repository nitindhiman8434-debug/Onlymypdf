import { NextRequest, NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { APP_URL } from "@/config/constants";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { checkAuthRateLimit, rateLimitResponse } from "@/lib/server/rate-limiter";
import { resolveSafeNextPath } from "@/lib/auth/safe-redirect";
import { toSafeApiError } from "@/lib/server/safe-error";
import { guardTurnstileRequest } from "@/lib/security/verify-turnstile-request";

const SSO_GENERIC_ERROR =
  "If SSO is enabled for your organization, continue with your identity provider.";

function normalizeDomain(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.includes("@")) return null;
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "").split("/")[0] ?? "";
  const domain = withoutProtocol.split(":")[0] ?? "";
  if (!domain.includes(".") || domain.length < 4) return null;
  return domain;
}

export async function POST(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await checkAuthRateLimit(request);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Enterprise SSO requires Supabase to be configured." },
        { status: 503 }
      );
    }

    const { domain: rawDomain, redirectTo, turnstileToken } = (await request.json()) as {
      domain?: string;
      redirectTo?: string;
      turnstileToken?: string;
    };

    const turnstileBlocked = await guardTurnstileRequest(request, turnstileToken);
    if (turnstileBlocked) return turnstileBlocked;

    const domain = rawDomain ? normalizeDomain(rawDomain) : null;
    if (!domain) {
      return NextResponse.json({ error: SSO_GENERIC_ERROR }, { status: 400 });
    }

    const appUrl = APP_URL.replace(/\/$/, "");
    const safeNext = redirectTo ? resolveSafeNextPath(redirectTo) : null;
    const callbackUrl = safeNext
      ? `${appUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`
      : `${appUrl}/auth/callback`;

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithSSO({
      domain,
      options: {
        redirectTo: callbackUrl,
      },
    });

    if (error || !data?.url) {
      return NextResponse.json({ error: SSO_GENERIC_ERROR }, { status: 400 });
    }

    return NextResponse.json({ url: data.url });
  } catch (err) {
    return NextResponse.json(
      { error: toSafeApiError(err, SSO_GENERIC_ERROR) },
      { status: 500 }
    );
  }
}
