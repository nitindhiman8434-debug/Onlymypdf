import { describe, expect, it } from "vitest";
import { resolveSafeNextPath } from "@/lib/auth/safe-redirect";

describe("resolveSafeNextPath", () => {
  it("allows dashboard and reset-password paths", () => {
    expect(resolveSafeNextPath("/dashboard")).toBe("/dashboard");
    expect(resolveSafeNextPath("/reset-password")).toBe("/reset-password");
    expect(resolveSafeNextPath("/dashboard/settings")).toBe("/dashboard/settings");
  });

  it("maps legacy account and settings paths", () => {
    expect(resolveSafeNextPath("/account")).toBe("/dashboard");
    expect(resolveSafeNextPath("/settings")).toBe("/dashboard/settings");
  });

  it("blocks billing and open redirects", () => {
    expect(resolveSafeNextPath("/dashboard/billing")).toBe("/dashboard");
    expect(resolveSafeNextPath("//evil.com")).toBe("/dashboard");
    expect(resolveSafeNextPath("https://evil.com")).toBe("/dashboard");
    expect(resolveSafeNextPath("/evil")).toBe("/dashboard");
  });

  it("blocks path traversal bypasses", () => {
    expect(resolveSafeNextPath("/dashboard/../../login")).toBe("/dashboard");
    expect(resolveSafeNextPath("/pricing/../../../contact")).toBe("/dashboard");
  });

  it("allows admin redirect paths", () => {
    expect(resolveSafeNextPath("/admin")).toBe("/admin");
    expect(resolveSafeNextPath("/admin/users")).toBe("/admin/users");
  });

  it("falls back when next is null", () => {
    expect(resolveSafeNextPath(null)).toBe("/dashboard");
    expect(resolveSafeNextPath(null, "/login")).toBe("/login");
  });
});
