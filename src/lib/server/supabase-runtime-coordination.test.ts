import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({ rpc: mocks.rpc })),
}));

import {
  checkSupabaseRateLimit,
  claimSupabaseOneTimeKey,
  releaseSupabaseHeavyJobLease,
  tryAcquireSupabaseHeavyJobLease,
} from "./supabase-runtime-coordination";

describe("Supabase runtime coordination RPC adapter", () => {
  beforeEach(() => mocks.rpc.mockReset());

  it("maps an atomic rate-limit decision", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ allowed: false, remaining: "0", retry_after_seconds: "12" }],
      error: null,
    });
    await expect(checkSupabaseRateLimit("client", 5, 60)).resolves.toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSec: 12,
    });
  });

  it("acquires and releases a distributed heavy-job lease", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    await expect(
      tryAcquireSupabaseHeavyJobLease("33333333-3333-4333-8333-333333333333", 4, 600)
    ).resolves.toBe(true);
    await releaseSupabaseHeavyJobLease("33333333-3333-4333-8333-333333333333");
  });

  it("claims an upload grant exactly once through the database RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await expect(claimSupabaseOneTimeKey("grant", 300)).resolves.toBe(true);
  });
});
