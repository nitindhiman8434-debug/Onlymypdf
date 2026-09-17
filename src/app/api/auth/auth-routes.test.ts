import { NextResponse, type NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  isSupabaseConfigured: vi.fn(),
}));

vi.mock("@/lib/auth/local-dev-auth", () => ({
  isLocalDevAuthEnabled: vi.fn(),
  attachLocalDevSessionCookie: vi.fn((response: NextResponse) => response),
  localDevSignIn: vi.fn(),
  getLocalDevSessionUser: vi.fn(),
}));

vi.mock("@/lib/auth/blocked-login", () => ({
  isUserLoginBlocked: vi.fn(),
  BLOCKED_LOGIN_MESSAGE: "Account blocked",
}));

vi.mock("@/lib/server/rate-limiter", () => ({
  checkAuthRateLimit: vi.fn(),
  checkLoginRateLimit: vi.fn(),
  checkLoginEmailRateLimit: vi.fn(),
  checkRateLimit: vi.fn(),
  rateLimitResponse: vi.fn((retryAfterSec: number) =>
    NextResponse.json({ error: "rate limited", retryAfterSec }, { status: 429 })
  ),
}));

vi.mock("@/lib/server/mutation-origin", () => ({
  guardMutationOrigin: vi.fn(),
}));

vi.mock("@/lib/server/safe-error", () => ({
  toSafeApiError: vi.fn((_err: unknown, fallback: string) => fallback),
}));

vi.mock("@/lib/auth/mfa-assurance", () => ({
  resolveMfaAssurance: vi.fn(),
  MfaAssuranceUnavailableError: class MfaAssuranceUnavailableError extends Error {},
}));

vi.mock("@/lib/auth/session-payload", () => ({
  buildSessionPayloadForUser: vi.fn(),
}));

import { createClient, createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isLocalDevAuthEnabled } from "@/lib/auth/local-dev-auth";
import { isUserLoginBlocked } from "@/lib/auth/blocked-login";
import { checkAuthRateLimit, checkLoginRateLimit, checkLoginEmailRateLimit, checkRateLimit } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { resolveMfaAssurance } from "@/lib/auth/mfa-assurance";
import { buildSessionPayloadForUser } from "@/lib/auth/session-payload";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as logoutPOST } from "@/app/api/auth/logout/route";
import { GET as sessionGET } from "@/app/api/auth/session/route";

function requestJson(body: unknown): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(),
    cookies: { getAll: vi.fn(() => []) },
  } as unknown as NextRequest;
}

describe("auth route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardMutationOrigin).mockReturnValue(null);
    vi.mocked(checkAuthRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 99,
      retryAfterSec: 0,
    });
    vi.mocked(checkLoginEmailRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 99,
      retryAfterSec: 0,
    });
    vi.mocked(checkLoginRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 99,
      retryAfterSec: 0,
    });
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 99,
      retryAfterSec: 0,
    });
    vi.mocked(isLocalDevAuthEnabled).mockReturnValue(false);
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(isUserLoginBlocked).mockResolvedValue(false);
  });

  it("rejects login without email/password", async () => {
    const response = await loginPOST(requestJson({ email: "", password: "" }));
    expect(response.status).toBe(400);
  });

  it("returns MFA challenge when required", async () => {
    const supabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: { id: "user-1", email: "user@example.com" },
            session: { access_token: "token" },
          },
          error: null,
        }),
        mfa: {
          listFactors: vi.fn().mockResolvedValue({
            data: { totp: [{ id: "factor-1", status: "verified" }] },
            error: null,
          }),
          challenge: vi.fn().mockResolvedValue({
            data: { id: "challenge-1" },
            error: null,
          }),
        },
        signOut: vi.fn(),
      },
    };
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const response = await loginPOST(
      requestJson({ email: "user@example.com", password: "secret123" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requiresMfa).toBe(true);
    expect(body.challengeId).toBe("challenge-1");
  });

  it("logs out successfully", async () => {
    const response = await logoutPOST(requestJson(null));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("Logged out successfully");
  });

  it("returns redacted session when MFA step-up is pending", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "user@example.com",
              created_at: "2026-01-01T00:00:00.000Z",
            },
          },
          error: null,
        }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "user-1", plan: "pro" },
              error: null,
            }),
          }),
        }),
      }),
    } as never);
    vi.mocked(resolveMfaAssurance).mockResolvedValue({
      requiresMfaVerification: true,
      currentLevel: "aal1",
      nextLevel: "aal2",
    } as never);
    vi.mocked(buildSessionPayloadForUser).mockResolvedValue({
      user: { id: "user-1" },
      profile: { plan: "pro" },
    } as never);

    const response = await sessionGET(requestJson(null));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requiresMfa).toBe(true);
    expect(body.profile).toBeNull();
    expect(body.mfaChallenge).toBeUndefined();
  });
});
