import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createEphemeralClient: vi.fn(),
}));

vi.mock("@/lib/auth/local-dev-auth", () => ({
  isLocalDevAuthEnabled: vi.fn(() => false),
  localDevSignIn: vi.fn(),
}));

import { createEphemeralClient } from "@/lib/supabase/server";
import { isLocalDevAuthEnabled, localDevSignIn } from "@/lib/auth/local-dev-auth";
import { verifyUserReauth } from "@/lib/auth/verify-reauth";

describe("verifyUserReauth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isLocalDevAuthEnabled).mockReturnValue(false);
  });

  it("rejects missing or short passwords", async () => {
    expect(await verifyUserReauth("user@example.com", "")).toBe(false);
    expect(await verifyUserReauth("user@example.com", "short")).toBe(false);
  });

  it("returns true when Supabase password sign-in succeeds", async () => {
    vi.mocked(createEphemeralClient).mockReturnValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({ error: null })),
      },
    } as never);

    await expect(
      verifyUserReauth("user@example.com", "correct-password")
    ).resolves.toBe(true);
  });

  it("returns false when Supabase password sign-in fails", async () => {
    vi.mocked(createEphemeralClient).mockReturnValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({
          error: new Error("Invalid login credentials"),
        })),
      },
    } as never);

    await expect(
      verifyUserReauth("user@example.com", "wrong-password")
    ).resolves.toBe(false);
  });

  it("uses local dev auth when enabled", async () => {
    vi.mocked(isLocalDevAuthEnabled).mockReturnValue(true);
    vi.mocked(localDevSignIn).mockResolvedValue({
      id: "dev-user",
      email: "dev@localhost",
      full_name: "Dev User",
      role: "user",
      plan: "free",
      created_at: new Date(0).toISOString(),
    });

    await expect(
      verifyUserReauth("dev@localhost", "dev-password")
    ).resolves.toBe(true);
    expect(localDevSignIn).toHaveBeenCalledWith({
      email: "dev@localhost",
      password: "dev-password",
    });
  });
});
