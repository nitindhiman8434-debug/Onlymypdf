import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const CORE_SECRETS = {
  NEXT_PUBLIC_APP_URL: "https://onlymypdf.in",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service",
  CRON_SECRET: "cron-secret-value",
  HEALTH_CHECK_SECRET: "health-check-secret-value",
  IP_HASH_SALT: "ip-hash-salt-value",
  SENTRY_DSN: "https://sentry.example.com/1",
  RESEND_API_KEY: "re_test_key",
  TURNSTILE_SECRET_KEY: "turnstile-secret-value",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site-key-value",
  STEP_UP_SECRET: "step-up-secret-value",
} as const;

const RAZORPAY_SECRETS = {
  NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_public",
  RAZORPAY_KEY_ID: "rzp_test",
  RAZORPAY_KEY_SECRET: "razorpay_secret",
  RAZORPAY_WEBHOOK_SECRET: "webhook_secret",
} as const;

describe("env-security", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", "onlymypdf.vercel.app");
    process.env = { ...env, ...CORE_SECRETS };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = env;
  });

  it("rejects ALLOW_INSECURE_CSRF=1 in production", async () => {
    process.env.BILLING_MODE = "live";
    Object.assign(process.env, RAZORPAY_SECRETS);
    process.env.ALLOW_INSECURE_CSRF = "1";

    const { assertProductionSecrets, isProductionReady } = await import(
      "@/lib/config/env-security"
    );

    expect(() => assertProductionSecrets()).toThrow(/ALLOW_INSECURE_CSRF/);
    expect(isProductionReady()).toBe(false);
  });

  it("rejects BILLING_MODE=mock in production", async () => {
    process.env.BILLING_MODE = "mock";
    delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const { assertProductionSecrets, isProductionReady } = await import(
      "@/lib/config/env-security"
    );

    expect(() => assertProductionSecrets()).toThrow(/BILLING_MODE=mock is not allowed/);
    expect(isProductionReady()).toBe(false);
  });

  it("allows BILLING_MODE=mock outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.BILLING_MODE = "mock";
    delete process.env.RAZORPAY_KEY_ID;

    const { assertProductionSecrets } = await import("@/lib/config/env-security");

    expect(() => assertProductionSecrets()).not.toThrow();
  });

  it("allows BILLING_MODE=disabled in production without Razorpay secrets", async () => {
    process.env.BILLING_MODE = "disabled";
    delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const { assertProductionSecrets, getProductionRequiredSecretKeys } = await import(
      "@/lib/config/env-security"
    );

    expect(getProductionRequiredSecretKeys()).not.toContain("RAZORPAY_WEBHOOK_SECRET");
    expect(() => assertProductionSecrets()).not.toThrow();
  });

  it("requires Razorpay webhook secret when billing is live", async () => {
    process.env.BILLING_MODE = "live";
    Object.assign(process.env, RAZORPAY_SECRETS);
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const { assertProductionSecrets, getProductionRequiredSecretKeys } = await import(
      "@/lib/config/env-security"
    );

    expect(getProductionRequiredSecretKeys()).toContain("RAZORPAY_WEBHOOK_SECRET");
    expect(() => assertProductionSecrets()).toThrow(/RAZORPAY_WEBHOOK_SECRET/);
  });

  it("passes when live billing and all Razorpay keys are set", async () => {
    process.env.BILLING_MODE = "live";
    Object.assign(process.env, RAZORPAY_SECRETS);

    const { assertProductionSecrets, isProductionReady } = await import(
      "@/lib/config/env-security"
    );

    expect(() => assertProductionSecrets()).not.toThrow();
    expect(isProductionReady()).toBe(true);
  });

  it("does not require the retired Upstash fallback", async () => {
    process.env.BILLING_MODE = "live";
    Object.assign(process.env, RAZORPAY_SECRETS);
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { assertProductionSecrets, getProductionRequiredSecretKeys } = await import(
      "@/lib/config/env-security"
    );

    expect(getProductionRequiredSecretKeys()).not.toContain("UPSTASH_REDIS_REST_URL");
    expect(getProductionRequiredSecretKeys()).not.toContain("UPSTASH_REDIS_REST_TOKEN");
    expect(() => assertProductionSecrets()).not.toThrow();
  });

  it("requires TRUSTED_PROXY_IP_HEADERS on self-hosted production", async () => {
    process.env.BILLING_MODE = "live";
    Object.assign(process.env, RAZORPAY_SECRETS);
    vi.stubEnv("VERCEL", undefined);
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("VERCEL_URL", undefined);
    delete process.env.TRUSTED_PROXY_IP_HEADERS;

    const { assertProductionSecrets } = await import("@/lib/config/env-security");

    expect(() => assertProductionSecrets()).toThrow(/TRUSTED_PROXY_IP_HEADERS/);
  });

  it("skips checks outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.CRON_SECRET;

    const { assertProductionSecrets, isProductionReady } = await import(
      "@/lib/config/env-security"
    );

    expect(() => assertProductionSecrets()).not.toThrow();
    expect(isProductionReady()).toBe(true);
  });
});

describe("payment.service verifyWebhookSignature", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...env };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = env;
  });

  it("accepts mock_webhook only in mock billing mode", async () => {
    vi.stubEnv("NODE_ENV", "test");
    process.env.BILLING_MODE = "mock";
    const { verifyWebhookSignature } = await import("@/lib/services/payment.service");
    expect(verifyWebhookSignature("{}", "mock_webhook")).toBe(true);
    expect(verifyWebhookSignature("{}", "real_sig")).toBe(false);
  });

  it("rejects mock_webhook in production even if billing mode is mock", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.BILLING_MODE = "mock";
    const { verifyWebhookSignature } = await import("@/lib/services/payment.service");
    expect(verifyWebhookSignature("{}", "mock_webhook")).toBe(false);
  });

  it("rejects webhooks in production live mode without webhook secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.BILLING_MODE = "live";
    process.env.RAZORPAY_KEY_SECRET = "key_secret";
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const { verifyWebhookSignature } = await import("@/lib/services/payment.service");
    expect(verifyWebhookSignature("{}", "some_signature")).toBe(false);
  });
});
