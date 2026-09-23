import { afterEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "CONVERSION_QUEUE_PROVIDER",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

async function provider() {
  vi.resetModules();
  return import("./conversion-queue-provider");
}

afterEach(() => {
  for (const key of ENV_KEYS) vi.stubEnv(key, "");
  vi.unstubAllEnvs();
});

describe("conversion queue provider selection", () => {
  it("uses memory when no remote provider is configured", async () => {
    for (const key of ENV_KEYS) vi.stubEnv(key, "");
    const { getConversionQueueProvider } = await provider();
    expect(getConversionQueueProvider()).toBe("memory");
  });

  it("prefers Supabase when its service credentials are configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-with-more-than-twenty-characters");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key-with-more-than-twenty-characters");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    const { getConversionQueueProvider } = await provider();
    expect(getConversionQueueProvider()).toBe("supabase");
  });

  it("keeps explicit local memory mode even when remote credentials exist", async () => {
    vi.stubEnv("CONVERSION_QUEUE_PROVIDER", "memory");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-with-more-than-twenty-characters");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key-with-more-than-twenty-characters");
    const { getConversionQueueProvider } = await provider();
    expect(getConversionQueueProvider()).toBe("memory");
  });

  it("reports an explicitly requested but unconfigured provider as unavailable", async () => {
    vi.stubEnv("CONVERSION_QUEUE_PROVIDER", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { getConversionQueueProvider } = await provider();
    expect(getConversionQueueProvider()).toBe("unavailable");
  });
});
