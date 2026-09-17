import { describe, expect, it } from "vitest";
import { escapeHtml, safeHttpUrl } from "@/lib/security/html";
import { timingSafeEqualString } from "@/lib/security/timing-safe";

describe("escapeHtml", () => {
  it("escapes markup in organization names", () => {
    expect(escapeHtml(`Acme <img src=x onerror=alert(1)>`)).toBe(
      "Acme &lt;img src=x onerror=alert(1)&gt;"
    );
  });
});

describe("safeHttpUrl", () => {
  it("rejects javascript URLs", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBe("#");
    expect(safeHttpUrl("https://onlymypdf.in/invite")).toBe(
      "https://onlymypdf.in/invite"
    );
  });
});

describe("timingSafeEqualString", () => {
  it("compares equal and unequal secrets", () => {
    expect(timingSafeEqualString("secret", "secret")).toBe(true);
    expect(timingSafeEqualString("secret", "secrex")).toBe(false);
    expect(timingSafeEqualString("short", "longer-secret")).toBe(false);
  });
});
