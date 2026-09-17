import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/security/csp";

describe("buildContentSecurityPolicy", () => {
  it("uses nonce and strict-dynamic in production without unsafe-inline scripts", () => {
    const csp = buildContentSecurityPolicy("abc123", true);
    expect(csp).toContain("'nonce-abc123'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("script-src 'unsafe-inline'");
  });

  it("allows unsafe-eval in development scripts", () => {
    const csp = buildContentSecurityPolicy("devnonce", false);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("tightens style-src in production", () => {
    const csp = buildContentSecurityPolicy("prodnonce", true);
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
    const styleSrc = csp.split("; ").find((d) => d.startsWith("style-src "));
    expect(styleSrc).toBe("style-src 'self' https://fonts.googleapis.com");
    expect(csp).toContain("connect-src 'self' blob:");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("report-uri /api/csp-report");
    expect(csp).toContain("upgrade-insecure-requests");
  });
});
