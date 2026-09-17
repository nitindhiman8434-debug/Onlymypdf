import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkOrganizationSharedUsageLimit,
  checkUsageLimitWithOrg,
  incrementOrganizationDailyUsage,
} from "@/lib/enterprise/org-limits.service";

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/enterprise/org-access.service", () => ({
  getPrimaryOrganizationForUser: vi.fn(),
}));

vi.mock("@/lib/db/admin-settings-cache", () => ({
  getCachedAdminSettings: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
  getUserDailyUsage: vi.fn(),
}));

vi.mock("@/lib/db/daily-usage-reserve", () => ({
  reserveOrganizationDailyUsage: vi.fn(),
  reserveDailyUsageSlot: vi.fn(),
}));

import { createServiceClient } from "@/lib/supabase/server";
import { getPrimaryOrganizationForUser } from "@/lib/enterprise/org-access.service";
import { getCachedAdminSettings } from "@/lib/db/admin-settings-cache";
import { getUserDailyUsage } from "@/lib/db/queries";
import {
  reserveDailyUsageSlot,
  reserveOrganizationDailyUsage,
} from "@/lib/db/daily-usage-reserve";

const today = new Date().toISOString().slice(0, 10);

describe("org-limits.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCachedAdminSettings).mockResolvedValue({});
    vi.mocked(getUserDailyUsage).mockResolvedValue(0);
  });

  it("denies usage when organization is missing", async () => {
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "missing" } }),
          }),
        }),
      }),
    } as never);

    await expect(checkOrganizationSharedUsageLimit("user-1", "org-missing")).resolves.toEqual({
      allowed: false,
      remaining: 0,
      limit: 0,
      message: "Organization not found.",
    });
  });

  it("allows usage when team daily limit is not reached", async () => {
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "org-1",
                daily_tool_limit: 100,
                daily_usage_date: today,
                daily_usage_count: 10,
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn(),
      }),
    } as never);

    await expect(checkOrganizationSharedUsageLimit("user-1", "org-1")).resolves.toEqual({
      allowed: true,
      remaining: 90,
      limit: 100,
      message: undefined,
    });
  });

  it("blocks usage when team daily limit is reached", async () => {
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "org-1",
                daily_tool_limit: 50,
                daily_usage_date: today,
                daily_usage_count: 50,
              },
              error: null,
            }),
          }),
        }),
      }),
    } as never);

    const result = await checkOrganizationSharedUsageLimit("user-1", "org-1");
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("team's daily limit");
  });

  it("increments organization usage for the current day", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                daily_usage_date: today,
                daily_usage_count: 4,
              },
              error: null,
            }),
          }),
        }),
        update,
      }),
    } as never);

    await incrementOrganizationDailyUsage("org-1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        daily_usage_count: 5,
        daily_usage_date: today,
      })
    );
  });

  it("uses organization shared limit when user belongs to active org", async () => {
    vi.mocked(getPrimaryOrganizationForUser).mockResolvedValue({
      id: "org-1",
      name: "Acme",
      plan_status: "active",
      plan_expires_at: null,
      daily_tool_limit: 20,
    });
    vi.mocked(reserveOrganizationDailyUsage).mockResolvedValue({
      allowed: true,
      remaining: 18,
      limit: 20,
    });

    await expect(checkUsageLimitWithOrg("user-1", "merge-pdf")).resolves.toEqual({
      allowed: true,
      remaining: 18,
      limit: 20,
      message: undefined,
      organizationId: "org-1",
    });
    expect(reserveOrganizationDailyUsage).toHaveBeenCalledWith(
      "org-1",
      20,
      expect.stringContaining("team's daily limit")
    );
  });

  it("falls back to pro daily limit when user has no active org", async () => {
    vi.mocked(getPrimaryOrganizationForUser).mockResolvedValue(null);
    vi.mocked(getCachedAdminSettings).mockResolvedValue({ pro_daily_tool_limit: 100 });
    vi.mocked(reserveDailyUsageSlot).mockResolvedValue({
      allowed: true,
      remaining: 100,
      limit: 100,
    });

    const result = await checkUsageLimitWithOrg("user-1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(100);
    expect(result.organizationId).toBeUndefined();
    expect(reserveDailyUsageSlot).toHaveBeenCalledWith(
      "user:user-1",
      100,
      expect.stringContaining("Daily Pro limit")
    );
  });
});
