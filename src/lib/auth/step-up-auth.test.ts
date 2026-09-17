import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  attachStepUpCookie,
  buildStepUpInitToken,
  clearStepUpCookie,
  verifyStepUpCookie,
  verifyStepUpInitToken,
} from "@/lib/auth/step-up-auth";

describe("step-up-auth", () => {
  beforeEach(() => {
    process.env.STEP_UP_SECRET = "test-step-up-secret";
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.STEP_UP_SECRET;
    vi.unstubAllEnvs();
  });

  it("issues and verifies a purpose-bound cookie", () => {
    const response = NextResponse.json({ ok: true });
    attachStepUpCookie(response, "user-1", "export");

    const cookie = response.cookies.get("pd_step_up")?.value;
    expect(cookie).toBeTruthy();

    const request = new NextRequest("http://localhost/api/user/account", {
      headers: { cookie: `pd_step_up=${cookie}` },
    });

    expect(verifyStepUpCookie(request, "user-1", "export")).toBe(true);
    expect(verifyStepUpCookie(request, "user-1", "delete")).toBe(false);
    expect(verifyStepUpCookie(request, "user-2", "export")).toBe(false);
  });

  it("binds OAuth step-up init tokens to the initiating user", () => {
    const init = buildStepUpInitToken("user-1", "delete");
    expect(verifyStepUpInitToken(init, "user-1", "delete")).toBe(true);
    expect(verifyStepUpInitToken(init, "user-2", "delete")).toBe(false);
    expect(verifyStepUpInitToken(init, "user-1", "export")).toBe(false);
  });

  it("requires STEP_UP_SECRET in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.STEP_UP_SECRET;
    expect(() => attachStepUpCookie(NextResponse.json({ ok: true }), "user-1", "export")).toThrow(
      /STEP_UP_SECRET/
    );
  });

  it("clears the step-up cookie", () => {
    const response = NextResponse.json({ ok: true });
    attachStepUpCookie(response, "user-1", "delete");
    clearStepUpCookie(response);
    expect(response.cookies.get("pd_step_up")?.value).toBe("");
  });
});
