import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  clearLocalDevSessionCookie,
  isLocalDevAuthEnabled,
} from "@/lib/auth/local-dev-auth";
import { checkAuthRateLimit, rateLimitResponse } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { clearStepUpCookie } from "@/lib/auth/step-up-auth";

function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("your_supabase") || key.includes("your_supabase")) {
    return null;
  }
  try {
    new URL(url);
    return key.length > 20 ? { url, key } : null;
  } catch {
    return null;
  }
}

function purgeSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.delete(cookie.name);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await checkAuthRateLimit(request);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);

    const response = NextResponse.json({ message: "Logged out successfully" });

    if (isLocalDevAuthEnabled()) {
      return clearStepUpCookie(clearLocalDevSessionCookie(response));
    }

    const env = getSupabaseEnv();
    if (!env) {
      return clearStepUpCookie(response);
    }

    const supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.signOut({ scope: "global" });
    purgeSupabaseAuthCookies(request, response);

    if (error) {
      console.warn("Supabase signOut error:", error.message);
    }

    return clearStepUpCookie(response);
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
