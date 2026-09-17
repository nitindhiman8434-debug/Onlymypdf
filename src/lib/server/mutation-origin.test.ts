import { describe, expect, it, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  guardMutationOrigin,
  guardSensitiveReadOrigin,
  guardToolMutationOrigin,
  isMutationOriginAllowed,
} from "@/lib/server/mutation-origin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mutation origin guard", () => {
  it("allows all origins when insecure CSRF is explicitly enabled", () => {
    vi.stubEnv("ALLOW_INSECURE_CSRF", "1");
    vi.stubEnv("NODE_ENV", "development");
    const request = new NextRequest("http://localhost/api/user/account", {
      method: "DELETE",
      headers: { origin: "https://evil.example" },
    });
    expect(isMutationOriginAllowed(request)).toBe(true);
    expect(guardMutationOrigin(request)).toBeNull();
  });

  it("enforces CSRF when app URL points to a public host even in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://onlymypdf.com");

    const request = new NextRequest("https://onlymypdf.com/api/user/account", {
      method: "DELETE",
      headers: { origin: "https://evil.example" },
    });

    expect(isMutationOriginAllowed(request)).toBe(false);
    const blocked = guardMutationOrigin(request);
    expect(blocked?.status).toBe(403);
    const body = await blocked!.json();
    expect(body.error).toMatch(/origin/i);
  });

  it("blocks cross-site mutations in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://onlymypdf.com");

    const request = new NextRequest("https://onlymypdf.com/api/user/account", {
      method: "DELETE",
      headers: { origin: "https://evil.example" },
    });

    expect(isMutationOriginAllowed(request)).toBe(false);
    const blocked = guardMutationOrigin(request);
    expect(blocked?.status).toBe(403);
  });

  it("allows same-site origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://onlymypdf.com");

    const request = new NextRequest("https://onlymypdf.com/api/user/account", {
      method: "DELETE",
      headers: { origin: "https://onlymypdf.com" },
    });

    expect(isMutationOriginAllowed(request)).toBe(true);
    expect(guardMutationOrigin(request)).toBeNull();
  });

  it("blocks API key requests that include browser Origin header", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://onlymypdf.com");

    const request = new NextRequest("https://onlymypdf.com/api/tools/merge-pdf", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "x-api-key": "omp_test_key",
      },
    });

    const blocked = guardToolMutationOrigin(request);
    expect(blocked?.status).toBe(403);
    const body = await blocked!.json();
    expect(body.error).toMatch(/origin/i);
  });

  it("allows API key requests without browser Origin or Referer", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://onlymypdf.com");

    const request = new NextRequest("https://onlymypdf.com/api/tools/merge-pdf", {
      method: "POST",
      headers: { "x-api-key": "omp_test_key" },
    });

    expect(guardToolMutationOrigin(request)).toBeNull();
  });

  it("blocks cross-origin sensitive GET reads", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://onlymypdf.com");

    const request = new NextRequest(
      "https://onlymypdf.com/api/tools/pdf-to-word/download?jobId=abc",
      {
        method: "GET",
        headers: { origin: "https://evil.example" },
      }
    );

    expect(guardSensitiveReadOrigin(request)).not.toBeNull();
  });
});
