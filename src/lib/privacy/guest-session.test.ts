import { describe, expect, it } from "vitest";
import { getGuestSessionIdFromRequest, GUEST_SESSION_COOKIE } from "./guest-session";

function mockRequest(init: {
  cookie?: string;
  header?: string;
}): import("next/server").NextRequest {
  const cookies = {
    get(name: string) {
      if (name === GUEST_SESSION_COOKIE && init.cookie) {
        return { name, value: init.cookie };
      }
      return undefined;
    },
  };
  const headers = new Headers();
  if (init.header) headers.set("x-session-id", init.header);

  return { cookies, headers } as import("next/server").NextRequest;
}

describe("guest session", () => {
  it("reads guest id from cookie", () => {
    const request = mockRequest({ cookie: "cookie-id", header: "header-id" });
    expect(getGuestSessionIdFromRequest(request)).toBe("cookie-id");
  });

  it("ignores x-session-id header for authorization", () => {
    const request = mockRequest({ header: "header-id" });
    expect(getGuestSessionIdFromRequest(request)).toBeNull();
  });

  it("returns null when absent", () => {
    expect(getGuestSessionIdFromRequest(mockRequest({}))).toBeNull();
  });
});
