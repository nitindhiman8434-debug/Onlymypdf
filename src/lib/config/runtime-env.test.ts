import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldEnforceMutationOrigin } from "@/lib/config/runtime-env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shouldEnforceMutationOrigin", () => {
  it("returns false when ALLOW_INSECURE_CSRF is set", () => {
    vi.stubEnv("ALLOW_INSECURE_CSRF", "1");
    vi.stubEnv("NODE_ENV", "production");
    expect(shouldEnforceMutationOrigin()).toBe(false);
  });

  it("returns true on Vercel production even if NODE_ENV is development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(shouldEnforceMutationOrigin()).toBe(true);
  });

  it("returns true when app URL is a public host", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://onlymypdf.com");
    expect(shouldEnforceMutationOrigin()).toBe(true);
  });
});
