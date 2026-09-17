import { describe, expect, it } from "vitest";
import { resolveUserAuthMethods } from "@/lib/auth/user-auth-methods";

describe("resolveUserAuthMethods", () => {
  it("detects password and oauth providers", () => {
    expect(
      resolveUserAuthMethods([
        { provider: "email" },
        { provider: "google" },
      ])
    ).toEqual({
      hasPassword: true,
      oauthProviders: ["google"],
    });
  });

  it("returns oauth-only accounts", () => {
    expect(resolveUserAuthMethods([{ provider: "github" }])).toEqual({
      hasPassword: false,
      oauthProviders: ["github"],
    });
  });
});
