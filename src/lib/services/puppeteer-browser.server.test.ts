import { describe, expect, it } from "vitest";
import { resolvePuppeteerLaunchArgs } from "@/lib/services/puppeteer-browser.server";

describe("resolvePuppeteerLaunchArgs", () => {
  it("keeps the Chromium sandbox enabled by default", () => {
    const args = resolvePuppeteerLaunchArgs({ NODE_ENV: "production" });
    expect(args).not.toContain("--no-sandbox");
  });

  it("rejects disabling the sandbox in ordinary production hosts", () => {
    expect(() =>
      resolvePuppeteerLaunchArgs({
        NODE_ENV: "production",
        PUPPETEER_DISABLE_SANDBOX: "1",
      })
    ).toThrow(/blocked in production/i);
  });

  it("allows no-sandbox only with an explicit hardened-container boundary", () => {
    const args = resolvePuppeteerLaunchArgs({
      NODE_ENV: "production",
      PUPPETEER_DISABLE_SANDBOX: "1",
      PUPPETEER_HARDENED_CONTAINER: "1",
    });
    expect(args).toContain("--no-sandbox");
  });
});
