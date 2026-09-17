import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pdf/pdf-session-store", () => ({
  buildOwnerHash: vi.fn((userId: string | null, guestKey: string | null) =>
    userId ? `user:${userId}` : `guest:${guestKey}`
  ),
}));

vi.mock("@/lib/server/client-ip", () => ({
  getGuestUsageKey: vi.fn(() => "hashed-ip-abc"),
}));

vi.mock("@/lib/privacy/guest-session", () => ({
  getGuestSessionIdFromRequest: vi.fn(() => "guest-session-xyz"),
}));

import { clientIpForLogs, ownerHashFromRequest } from "@/lib/server/request-security";

describe("request-security", () => {
  it("builds owner hash from authenticated user id", () => {
    const request = new NextRequest("https://onlymypdf.com/");
    expect(ownerHashFromRequest(request, "user-123")).toBe("user:user-123");
  });

  it("builds guest owner hash from IP key and session cookie", () => {
    const request = new NextRequest("https://onlymypdf.com/");
    expect(ownerHashFromRequest(request, null)).toBe(
      "guest:hashed-ip-abc:guest-session-xyz"
    );
  });

  it("returns hashed IP for usage logs", () => {
    const request = new NextRequest("https://onlymypdf.com/");
    expect(clientIpForLogs(request)).toBe("hashed-ip-abc");
  });
});
