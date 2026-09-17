import { describe, expect, it } from "vitest";
import { resolveLoginFlashError, resolveLoginFlashMessage } from "@/lib/auth/login-flash";

describe("login flash messages", () => {
  it("resolves known success codes", () => {
    expect(resolveLoginFlashMessage("password_updated")).toContain("Password updated");
  });

  it("ignores unknown success codes", () => {
    expect(resolveLoginFlashMessage("Fake alert from attacker")).toBeNull();
  });

  it("resolves known error codes", () => {
    expect(resolveLoginFlashError("oauth_failed")).toContain("Sign-in");
  });

  it("ignores unknown error codes", () => {
    expect(resolveLoginFlashError("Your account was hacked")).toBeNull();
  });
});
