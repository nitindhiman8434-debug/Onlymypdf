import { describe, expect, it, vi, beforeEach } from "vitest";
import { isUserLoginBlocked } from "@/lib/auth/blocked-login";

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@/lib/supabase/server";

describe("isUserLoginBlocked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for an unblocked profile", async () => {
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { is_blocked: false },
              error: null,
            }),
          }),
        }),
      }),
    } as never);

    await expect(isUserLoginBlocked("user-1")).resolves.toBe(false);
  });

  it("fails closed when the profile lookup errors", async () => {
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "db down" },
            }),
          }),
        }),
      }),
    } as never);

    await expect(isUserLoginBlocked("user-1")).resolves.toBe(true);
  });
});
