import { describe, expect, it, vi, afterEach } from "vitest";

import { isCronAuthorized } from "./cron-auth";



describe("isCronAuthorized", () => {

  const secret = "test-secret";



  afterEach(() => {

    vi.unstubAllEnvs();

  });



  it("accepts bearer token", () => {

    expect(isCronAuthorized(`Bearer ${secret}`, null, secret)).toBe(true);

  });



  it("rejects vercel cron header without bearer secret", () => {

    vi.stubEnv("VERCEL", "1");

    vi.stubEnv("VERCEL_ENV", "production");

    vi.stubEnv("VERCEL_URL", "onlymypdf.vercel.app");

    expect(isCronAuthorized(null, "1", secret)).toBe(false);

  });



  it("rejects vercel cron header off Vercel", () => {

    vi.stubEnv("VERCEL", undefined);

    expect(isCronAuthorized(null, "1", secret)).toBe(false);

  });



  it("rejects missing secret", () => {

    expect(isCronAuthorized(`Bearer ${secret}`, null, undefined)).toBe(false);

  });

});
