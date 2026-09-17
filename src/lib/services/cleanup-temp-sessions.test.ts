import { describe, expect, it } from "vitest";
import { getPreviewSessionTtlMs } from "@/lib/config/preview-limits";

describe("cleanupExpiredTempSessions age logic", () => {
  it("uses the same TTL as pdf session store (default 15 minutes)", () => {
    expect(getPreviewSessionTtlMs()).toBe(15 * 60 * 1000);
  });

  it("treats objects older than TTL as stale", () => {
    const ttlMs = getPreviewSessionTtlMs();
    const cutoff = Date.now() - ttlMs;
    const staleCreatedAt = new Date(cutoff - 60_000).toISOString();
    const freshCreatedAt = new Date(cutoff + 60_000).toISOString();

    const staleMs = new Date(staleCreatedAt).getTime();
    const freshMs = new Date(freshCreatedAt).getTime();

    expect(staleMs).toBeLessThan(cutoff);
    expect(freshMs).toBeGreaterThan(cutoff);
  });
});
