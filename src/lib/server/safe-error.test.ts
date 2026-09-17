import { describe, expect, it } from "vitest";
import { captureApiError, toSafeApiError } from "@/lib/server/safe-error";

describe("toSafeApiError", () => {
  it("returns whitelisted messages verbatim", () => {
    expect(toSafeApiError(new Error("Incorrect password."))).toBe("Incorrect password.");
    expect(toSafeApiError(new Error("Daily usage limit reached."))).toBe(
      "Daily usage limit reached."
    );
  });

  it("passes through short user-facing validation messages", () => {
    expect(toSafeApiError(new Error("Invalid coupon code"))).toBe("Invalid coupon code");
    expect(toSafeApiError(new Error("File is required"))).toBe("File is required");
  });

  it("redacts internal paths and unknown errors", () => {
    expect(toSafeApiError(new Error("ENOENT /tmp/secret.pdf"))).toBe(
      "An unexpected error occurred. Please try again."
    );
    expect(toSafeApiError("boom", "Custom fallback")).toBe("Custom fallback");
  });

  it("passes through mapped conversion messages", () => {
    expect(
      toSafeApiError(
        new Error(
          "Conversion did not produce a Word file. Please try again or use a different PDF."
        )
      )
    ).toBe("Conversion did not produce a Word file. Please try again or use a different PDF.");
  });
});

describe("captureApiError", () => {
  it("no-ops outside production", () => {
    expect(() => captureApiError(new Error("test"), { route: "x" })).not.toThrow();
  });
});
