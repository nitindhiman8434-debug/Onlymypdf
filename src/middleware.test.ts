import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { middleware } from "@/middleware";
import { updateSession } from "@/lib/supabase/middleware";

vi.mock("@/lib/supabase/middleware", () => ({ updateSession: vi.fn() }));
vi.mock("@/lib/auth/auth-config", () => ({ isLocalDevAuthEnabled: () => false }));
vi.mock("@/lib/auth/local-dev-session-edge", () => ({
  getLocalDevUserIdFromRequestEdge: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(updateSession).mockResolvedValue({
    supabaseResponse: NextResponse.next(),
    user: null,
    profileRole: null,
    profileBlocked: false,
    mfaVerificationRequired: false,
  });
});

describe("English-only public routing", () => {
  it.each([
    ["/hi", "/"],
    ["/hi/", "/"],
    ["/hi/pdf-to-word?qa=1&lang=hi", "/pdf-to-word?qa=1"],
    ["/hi/dashboard/feedback?qa=1", "/dashboard/feedback?qa=1"],
  ])("redirects %s to its English URL before auth", async (path, expected) => {
    const response = await middleware(new NextRequest(`https://onlymypdf.test${path}`));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(`https://onlymypdf.test${expected}`);
    expect(updateSession).not.toHaveBeenCalled();
  });

  it.each(["/hi//other.test", "/hi/%2F%2Fother.test", "/hi/%5C%5Cother.test"])(
    "never changes origin for malformed legacy path %s", async (path) => {
      const response = await middleware(new NextRequest(`https://onlymypdf.test${path}`));
      const destination = new URL(response.headers.get("location")!);
      expect(destination.origin).toBe("https://onlymypdf.test");
    }
  );

  it.each(["/api", "/api/health", "/api/tools/pdf-to-word?lang=hi"])(
    "does not redirect or rewrite an API request %s", async (path) => {
      const response = await middleware(new NextRequest(`https://onlymypdf.test${path}`, {
        headers: { cookie: "pd_locale=hi; pd_guest_session=existing-guest" },
      }));
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(updateSession).not.toHaveBeenCalled();
    }
  );

  it("does not expose a second API endpoint under the legacy locale prefix", async () => {
    const response = await middleware(new NextRequest("https://onlymypdf.test/hi/api/health"));
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });

  it("ignores and expires a stale Hindi cookie while forwarding an English locale", async () => {
    const response = await middleware(new NextRequest("https://onlymypdf.test/pricing?lang=hi", {
      headers: { cookie: "pd_locale=hi; pd_guest_session=existing-guest", "x-locale": "hi" },
    }));
    expect(response.headers.get("x-locale")).toBe("en");
    expect(response.headers.get("x-middleware-request-x-locale")).toBe("en");
    expect(response.cookies.get("pd_locale")?.value).toBe("");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });

  it("keeps English dashboard authentication protection", async () => {
    const response = await middleware(new NextRequest("https://onlymypdf.test/dashboard/feedback"));
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe("/login");
    expect(destination.searchParams.get("redirect")).toBe("/dashboard/feedback");
  });

  it("does not treat similarly named English routes as a Hindi prefix", async () => {
    const response = await middleware(new NextRequest("https://onlymypdf.test/history"));
    expect(response.headers.get("location")).toBeNull();
  });
});
