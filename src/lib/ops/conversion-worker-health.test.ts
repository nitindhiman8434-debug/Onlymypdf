import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/upstash-kv", () => ({
  getUpstashRedis: vi.fn(async () => null),
  isUpstashConfigured: vi.fn(() => false),
  upstashGetJson: vi.fn(async () => null),
}));

import {
  getConversionWorkerHealth,
  recordConversionWorkerHeartbeat,
} from "./conversion-worker-health";

describe("conversion worker heartbeat", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports a recent healthy heartbeat", async () => {
    const now = new Date("2026-09-17T10:00:00.000Z");
    await recordConversionWorkerHeartbeat({ state: "idle" }, now);
    const health = await getConversionWorkerHealth(now.getTime() + 30_000);
    expect(health.ok).toBe(true);
    expect(health.detail).toContain("state=idle");
  });

  it("rejects a stale heartbeat", async () => {
    const now = new Date("2026-09-17T10:00:00.000Z");
    await recordConversionWorkerHeartbeat({ state: "ready" }, now);
    const health = await getConversionWorkerHealth(now.getTime() + 150_001);
    expect(health.ok).toBe(false);
  });

  it("rejects an explicit worker error", async () => {
    const now = new Date("2026-09-17T10:00:00.000Z");
    await recordConversionWorkerHeartbeat({ state: "error" }, now);
    const health = await getConversionWorkerHealth(now.getTime());
    expect(health.ok).toBe(false);
  });
});
