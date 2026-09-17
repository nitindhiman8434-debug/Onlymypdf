import { describe, expect, it } from "vitest";
import { sanitizeHtmlPreview } from "@/lib/security/sanitize-html-preview";

describe("sanitizeHtmlPreview", () => {
  it("removes script tags and inline event handlers", () => {
    const html = '<p onclick="alert(1)">Hi</p><script>alert("xss")</script>';
    const sanitized = sanitizeHtmlPreview(html);
    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("onclick");
    expect(sanitized).toContain("Hi");
  });

  it("neutralizes javascript: href values", () => {
    const html = '<a href="javascript:alert(1)">Click</a>';
    const sanitized = sanitizeHtmlPreview(html);
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).toContain('href="#"');
  });
});
