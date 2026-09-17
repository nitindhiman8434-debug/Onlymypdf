import { describe, expect, it, afterEach, vi } from "vitest";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

describe("verifyTurnstileToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips verification in development when secret is unset", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    await expect(verifyTurnstileToken(undefined)).resolves.toBe(true);
  });

  it("fails closed in production when secret is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    await expect(verifyTurnstileToken(undefined)).resolves.toBe(false);
  });

  it("rejects missing tokens when secret is configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    await expect(verifyTurnstileToken(undefined)).resolves.toBe(false);
  });
});
