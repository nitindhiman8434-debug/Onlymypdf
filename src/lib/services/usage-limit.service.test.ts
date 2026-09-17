import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkAIUsageLimit, checkFileSizeLimit, requireProPlan } from "@/lib/services/usage-limit.service";

vi.mock("@/lib/db/queries", () => ({
  getUserDailyUsage: vi.fn(),
  getGuestDailyUsage: vi.fn(),
  getUserProfile: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/db/admin-settings-cache", () => ({
  getCachedAdminSettings: vi.fn(),
}));

vi.mock("@/lib/enterprise/org-access.service", () => ({
  resolveProAccessForUser: vi.fn(),
}));

vi.mock("@/lib/db/daily-usage-reserve", () => ({
  reserveDailyUsageSlot: vi.fn(),
}));

import { getUserProfile } from "@/lib/db/queries";
import { getCachedAdminSettings } from "@/lib/db/admin-settings-cache";
import { resolveProAccessForUser } from "@/lib/enterprise/org-access.service";
import { reserveDailyUsageSlot } from "@/lib/db/daily-usage-reserve";

describe("usage-limit helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCachedAdminSettings).mockResolvedValue({});
    vi.mocked(getUserProfile).mockResolvedValue({ plan: "free" } as never);
  });

  it("allows files under the free size limit", async () => {
    const result = await checkFileSizeLimit(null, 1024);
    expect(result.allowed).toBe(true);
    expect(result.maxSizeMB).toBeGreaterThan(0);
  });

  it("rejects pro-only tools for guests", async () => {
    const result = await requireProPlan(null);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("log in");
  });

  it("rejects pro-only tools for free users", async () => {
    vi.mocked(resolveProAccessForUser).mockResolvedValue({
      isPro: false,
      source: "individual",
      organizationId: undefined,
    });

    const result = await requireProPlan("user-1");
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("Pro");
  });

  it("reserves AI usage atomically for free users", async () => {
    vi.mocked(resolveProAccessForUser).mockResolvedValue({
      isPro: false,
      source: "individual",
      organizationId: undefined,
    });
    vi.mocked(getCachedAdminSettings).mockResolvedValue({ free_daily_ai_limit: 1 });
    vi.mocked(reserveDailyUsageSlot).mockResolvedValue({
      allowed: true,
      remaining: 0,
      limit: 1,
    });

    const result = await checkAIUsageLimit("user-1", "free");
    expect(result.allowed).toBe(true);
    expect(reserveDailyUsageSlot).toHaveBeenCalledWith(
      "ai:user:user-1",
      1,
      expect.stringContaining("Daily AI summary limit")
    );
  });
});
