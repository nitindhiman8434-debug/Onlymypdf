import type { NextRequest } from "next/server";
import { createHash } from "crypto";
import { extractApiKeyFromRequest, hashApiKey } from "@/lib/auth/api-key-auth";
import { buildRateLimitMessage, type RateLimitScope } from "@/lib/rate-limit-message";
import { getGuestUsageKey, getTrustedClientIp } from "@/lib/server/client-ip";
import { CORRELATION_ID_HEADER, getCorrelationId } from "@/lib/server/correlation-id";
import { isSupabaseServiceConfigured } from "@/lib/supabase/server";
import { checkSupabaseRateLimit } from "@/lib/server/supabase-runtime-coordination";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function store(): Map<string, Bucket> {
  const g = globalThis as typeof globalThis & { __rateLimitBuckets?: Map<string, Bucket> };
  if (!g.__rateLimitBuckets) g.__rateLimitBuckets = buckets;
  return g.__rateLimitBuckets;
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

/** Per-client bucket: real IP when trusted, otherwise guest-session-scoped hash. */
export function rateLimitClientKey(request: NextRequest): string {
  const ip = getTrustedClientIp(request);
  if (ip !== "unknown") return ip;
  return getGuestUsageKey(request);
}

function memoryRateLimit(
  request: NextRequest,
  options: {
    keyPrefix: string;
    maxRequests: number;
    windowMs: number;
    keySuffix?: string;
  }
): RateLimitResult {
  const clientKey = rateLimitClientKey(request);
  const key = `${options.keyPrefix}:${clientKey}${options.keySuffix ? `:${options.keySuffix}` : ""}`;
  const now = Date.now();
  const map = store();

  let bucket = map.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + options.windowMs };
    map.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, options.maxRequests - bucket.count),
    retryAfterSec: 0,
  };
}

const upstashLimiters = new Map<
  string,
  { limit: (key: string) => Promise<{ success: boolean; reset: number }> }
>();

async function getUpstashLimiter(maxRequests: number, windowSec: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const cacheKey = `${maxRequests}:${windowSec}`;
  const cached = upstashLimiters.get(cacheKey);
  if (cached) return cached;

  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url, token });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSec} s`),
    prefix: `pdf-doctor:${cacheKey}`,
  });
  upstashLimiters.set(cacheKey, limiter);
  return limiter;
}

export async function checkRateLimit(
  request: NextRequest,
  options: {
    keyPrefix: string;
    maxRequests: number;
    windowMs: number;
    keySuffix?: string;
  }
): Promise<RateLimitResult> {
  const clientKey = rateLimitClientKey(request);
  const key = `${options.keyPrefix}:${clientKey}${options.keySuffix ? `:${options.keySuffix}` : ""}`;
  const windowSec = Math.max(1, Math.ceil(options.windowMs / 1000));

  try {
    if (isSupabaseServiceConfigured()) {
      return await checkSupabaseRateLimit(
        `pdf-doctor:${createHash("sha256").update(key).digest("hex")}`,
        options.maxRequests,
        windowSec
      );
    }

    const limiter = await getUpstashLimiter(options.maxRequests, windowSec);
    if (limiter) {
      const result = await limiter.limit(key);
      if (!result.success) {
        const retryAfterSec = Math.max(
          1,
          Math.ceil((result.reset - Date.now()) / 1000)
        );
        return { allowed: false, remaining: 0, retryAfterSec };
      }
      return { allowed: true, remaining: 0, retryAfterSec: 0 };
    }

    if (process.env.NODE_ENV === "production") {
      console.error("[rate-limit] Distributed store unavailable in production — denying request");
      return { allowed: false, remaining: 0, retryAfterSec: 60 };
    }
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      console.error("[rate-limit] Distributed store error in production:", err);
      return { allowed: false, remaining: 0, retryAfterSec: 60 };
    }
  }

  return memoryRateLimit(request, options);
}

export function rateLimitResponse(
  retryAfterSec: number,
  request?: NextRequest,
  scope: RateLimitScope = "generic"
) {
  const correlationId = getCorrelationId(request);
  const error = buildRateLimitMessage(scope, retryAfterSec, "en");
  return new Response(
    JSON.stringify({
      error,
      correlationId,
      retryAfterSec,
      rateLimitScope: scope,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
        [CORRELATION_ID_HEADER]: correlationId,
      },
    }
  );
}

/** Login / signup: 5 attempts per minute per IP */
export async function checkLoginRateLimit(request: NextRequest): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "auth-login",
    maxRequests: 5,
    windowMs: 60 * 1000,
  });
}

/** Password reset + OTP: 3 attempts per hour per IP */
export async function checkPasswordResetRateLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "auth-password-reset",
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
  });
}

/** Login: 8 attempts per 15 minutes per normalized email (credential stuffing mitigation). */
export async function checkLoginEmailRateLimit(
  request: NextRequest,
  email: string
): Promise<RateLimitResult> {
  const { emailRateLimitSuffix } = await import("@/lib/security/turnstile");
  return checkRateLimit(request, {
    keyPrefix: "auth-login-email",
    keySuffix: emailRateLimitSuffix(email),
    maxRequests: 8,
    windowMs: 15 * 60 * 1000,
  });
}

/** Signup: 5 attempts per hour per normalized email (anti-harassment / inbox flooding). */
export async function checkSignupEmailRateLimit(
  request: NextRequest,
  email: string
): Promise<RateLimitResult> {
  const { emailRateLimitSuffix } = await import("@/lib/security/turnstile");
  return checkRateLimit(request, {
    keyPrefix: "auth-signup-email",
    keySuffix: emailRateLimitSuffix(email),
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  });
}

/** Password reset: 3 attempts per hour per normalized email (anti-harassment). */
export async function checkPasswordResetEmailRateLimit(
  request: NextRequest,
  email: string
): Promise<RateLimitResult> {
  const { emailRateLimitSuffix } = await import("@/lib/security/turnstile");
  return checkRateLimit(request, {
    keyPrefix: "auth-password-reset-email",
    keySuffix: emailRateLimitSuffix(email),
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
  });
}

/** Contact form: 5 submissions per hour per client. */
export async function checkContactRateLimit(request: NextRequest): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "contact",
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  });
}

/** Contact form: 3 submissions per hour per sender email. */
export async function checkContactEmailRateLimit(
  request: NextRequest,
  email: string
): Promise<RateLimitResult> {
  const { emailRateLimitSuffix } = await import("@/lib/security/turnstile");
  return checkRateLimit(request, {
    keyPrefix: "contact-email",
    keySuffix: emailRateLimitSuffix(email),
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
  });
}

/** Coupon attempts: 10 per 15 minutes per user. */
export async function checkCouponAttemptRateLimit(
  request: NextRequest,
  userId: string
): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "coupon-attempt",
    keySuffix: userId,
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
  });
}

/** Recovery session probe: 30 per 15 minutes per client. */
export async function checkRecoverySessionRateLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "auth-recovery-session",
    maxRequests: 30,
    windowMs: 15 * 60 * 1000,
  });
}

/** Subscription cancel: 3 per hour per user. */
export async function checkSubscriptionCancelRateLimit(
  request: NextRequest,
  userId: string
): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "subscription-cancel",
    keySuffix: userId,
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
  });
}

/** MFA verify: 8 attempts per 15 minutes per client + factor suffix. */
export async function checkMfaVerifyRateLimit(
  request: NextRequest,
  factorId: string
): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "auth-mfa-verify",
    keySuffix: factorId.slice(0, 36),
    maxRequests: 8,
    windowMs: 15 * 60 * 1000,
  });
}

/** Password re-auth for export/delete: 5 per 15 minutes per user. */
export async function checkReauthRateLimit(
  request: NextRequest,
  userId: string
): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "auth-reauth",
    keySuffix: userId,
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
  });
}

/** Other auth mutations (OAuth, MFA, logout): 10 per 15 minutes per IP */
export async function checkAuthRateLimit(request: NextRequest): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "auth",
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
  });
}

/** Tool API: 60 requests per minute per IP */
export async function checkToolRateLimit(
  request: NextRequest,
  toolSlug: string
): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "tool",
    keySuffix: toolSlug,
    maxRequests: 60,
    windowMs: 60 * 1000,
  });
}

/** Admin API: 40 requests per 15 minutes per IP */
export async function checkAdminRateLimit(request: NextRequest): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "admin",
    maxRequests: 40,
    windowMs: 15 * 60 * 1000,
  });
}

/** PDF helper routes (thumbnails/previews): 600/min — a multi-page PDF loads
 * many thumbnails at once, and these are cheap preview renders, not conversions. */
export async function checkPdfHelperRateLimit(request: NextRequest): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "pdf-helper",
    maxRequests: 600,
    windowMs: 60 * 1000,
  });
}

/**
 * Thumbnail GET reads: separate high-cap bucket. A 500-page PDF can fire hundreds
 * of parallel image requests; they must not share the pdf-helper mutation budget.
 */
export async function checkPdfThumbRateLimit(request: NextRequest): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "pdf-thumb",
    maxRequests: 5000,
    windowMs: 60 * 1000,
  });
}

export async function guardToolRateLimit(
  request: NextRequest,
  toolSlug: string
): Promise<Response | null> {
  const toolRate = await checkToolRateLimit(request, toolSlug);
  if (!toolRate.allowed) return rateLimitResponse(toolRate.retryAfterSec);
  return null;
}

/**
 * Job status/download polling: dedicated generous bucket, separate from the
 * per-tool convert limit. Long conversions poll status frequently, so these
 * lightweight owner-gated reads must not exhaust the convert bucket.
 */
export async function checkPollRateLimit(
  request: NextRequest,
  jobSlug: string
): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "poll",
    keySuffix: jobSlug,
    maxRequests: 1800,
    windowMs: 60 * 1000,
  });
}

export async function guardPollRateLimit(
  request: NextRequest,
  jobSlug: string
): Promise<Response | null> {
  const rate = await checkPollRateLimit(request, jobSlug);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);
  return null;
}

export async function guardPdfHelperRateLimit(request: NextRequest): Promise<Response | null> {
  const rate = await checkPdfHelperRateLimit(request);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);
  return null;
}

export async function guardPdfThumbRateLimit(request: NextRequest): Promise<Response | null> {
  const rate = await checkPdfThumbRateLimit(request);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);
  return null;
}

export async function guardAdminRateLimit(request: NextRequest): Promise<Response | null> {
  const rate = await checkAdminRateLimit(request);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);
  return null;
}

/** General API routes (files, user, privacy): 120 requests per 15 minutes per IP */
export async function checkGeneralApiRateLimit(request: NextRequest): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "api",
    maxRequests: 120,
    windowMs: 15 * 60 * 1000,
  });
}

export async function guardGeneralApiRateLimit(request: NextRequest): Promise<Response | null> {
  const rate = await checkGeneralApiRateLimit(request);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);
  return null;
}

/** Razorpay webhooks: cap unsigned/signed flood per IP before HMAC verification. */
export async function checkWebhookRateLimit(request: NextRequest): Promise<RateLimitResult> {
  return checkRateLimit(request, {
    keyPrefix: "webhook",
    maxRequests: 200,
    windowMs: 60 * 1000,
  });
}

export async function guardWebhookRateLimit(request: NextRequest): Promise<Response | null> {
  const rate = await checkWebhookRateLimit(request);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);
  return null;
}

/** Per-API-key bucket: 120 tool mutations per minute (when x-api-key / Bearer omp_* present). */
export async function guardApiKeyRateLimit(
  request: NextRequest,
  toolSlug: string
): Promise<Response | null> {
  const raw = extractApiKeyFromRequest(request);
  if (!raw) return null;

  const keySuffix = `${hashApiKey(raw).slice(0, 20)}:${toolSlug}`;
  const rate = await checkRateLimit(request, {
    keyPrefix: "api-key",
    keySuffix,
    maxRequests: 120,
    windowMs: 60 * 1000,
  });
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);
  return null;
}
