import type { NextRequest } from "next/server";
import { hasApiKeyHeader } from "@/lib/auth/api-key-auth";
import { shouldEnforceMutationOrigin } from "@/lib/config/runtime-env";

function allowedHosts(): Set<string> {
  const hosts = new Set<string>(["localhost", "127.0.0.1"]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      hosts.add(new URL(appUrl).host);
    } catch {
      // ignore malformed URL
    }
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) hosts.add(vercel);
  return hosts;
}

function hostFromHeader(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/**
 * CSRF mitigation for cookie-authenticated POST routes.
 * Skipped only for trusted local dev or when ALLOW_INSECURE_CSRF=1.
 */
export function isMutationOriginAllowed(request: NextRequest): boolean {
  if (!shouldEnforceMutationOrigin()) return true;

  const originHost = hostFromHeader(request.headers.get("origin"));
  const refererHost = hostFromHeader(request.headers.get("referer"));

  if (!originHost && !refererHost) return false;

  const allowed = allowedHosts();
  if (originHost && allowed.has(originHost)) return true;
  if (refererHost && allowed.has(refererHost)) return true;

  return false;
}

export function mutationOriginDeniedResponse() {
  return new Response(JSON.stringify({ error: "Invalid request origin" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export function guardMutationOrigin(request: NextRequest): Response | null {
  if (!isMutationOriginAllowed(request)) {
    return mutationOriginDeniedResponse();
  }
  return null;
}

/** CSRF guard for state-changing GET handlers (e.g. one-time file download). */
export function guardSensitiveReadOrigin(request: NextRequest): Response | null {
  return guardMutationOrigin(request);
}

/** CSRF for browser sessions; API keys allowed only without browser Origin/Referer. */
export function guardToolMutationOrigin(request: NextRequest): Response | null {
  if (hasApiKeyHeader(request)) {
    if (shouldEnforceMutationOrigin()) {
      const origin = request.headers.get("origin");
      const referer = request.headers.get("referer");
      if (origin || referer) {
        return mutationOriginDeniedResponse();
      }
    }
    return null;
  }
  return guardMutationOrigin(request);
}
