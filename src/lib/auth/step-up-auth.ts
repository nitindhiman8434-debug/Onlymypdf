import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";

export const STEP_UP_COOKIE = "pd_step_up";

export type StepUpPurpose = "export" | "delete" | "mfa_enroll";

const STEP_UP_PURPOSES = new Set<StepUpPurpose>(["export", "delete", "mfa_enroll"]);
const TTL_MS = 5 * 60 * 1000;
const INIT_TTL_MS = 10 * 60 * 1000;

function getStepUpSecret(): string {
  const dedicated = process.env.STEP_UP_SECRET?.trim();
  if (dedicated) return dedicated;

  if (process.env.NODE_ENV === "production") {
    throw new Error("STEP_UP_SECRET is required for step-up auth in production");
  }

  const devFallback = process.env.CRON_SECRET?.trim();
  return devFallback || "dev-step-up-only";
}

export function isStepUpPurpose(value: string | null): value is StepUpPurpose {
  return value != null && STEP_UP_PURPOSES.has(value as StepUpPurpose);
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", getStepUpSecret()).update(payload).digest("hex");
}

function buildSignedToken(payload: string): string {
  const signature = signPayload(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

function parseSignedToken(
  token: string
): { userId: string; purpose: StepUpPurpose; exp: number; kind?: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const separator = decoded.lastIndexOf(".");
    if (separator === -1) return null;

    const payload = decoded.slice(0, separator);
    const signature = decoded.slice(separator + 1);
    if (signature !== signPayload(payload)) return null;

    const parsed = JSON.parse(payload) as {
      userId: string;
      purpose: StepUpPurpose;
      exp: number;
      kind?: string;
    };
    if (!parsed.userId || !isStepUpPurpose(parsed.purpose) || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildToken(userId: string, purpose: StepUpPurpose): string {
  const payload = JSON.stringify({
    userId,
    purpose,
    exp: Date.now() + TTL_MS,
    kind: "step-up",
  });
  return buildSignedToken(payload);
}

/** Short-lived token binding OAuth step-up to the user who initiated it. */
export function buildStepUpInitToken(userId: string, purpose: StepUpPurpose): string {
  const payload = JSON.stringify({
    userId,
    purpose,
    exp: Date.now() + INIT_TTL_MS,
    kind: "init",
  });
  return buildSignedToken(payload);
}

export function verifyStepUpInitToken(
  token: string,
  expectedUserId: string,
  expectedPurpose: StepUpPurpose
): boolean {
  const parsed = parseSignedToken(token);
  return (
    parsed?.kind === "init" &&
    parsed.userId === expectedUserId &&
    parsed.purpose === expectedPurpose
  );
}

export function attachStepUpCookie(
  response: NextResponse,
  userId: string,
  purpose: StepUpPurpose
): NextResponse {
  response.cookies.set(STEP_UP_COOKIE, buildToken(userId, purpose), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(TTL_MS / 1000),
  });
  return response;
}

export function clearStepUpCookie(response: NextResponse): NextResponse {
  response.cookies.set(STEP_UP_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export function verifyStepUpCookie(
  request: NextRequest,
  userId: string,
  purpose: StepUpPurpose
): boolean {
  const token = request.cookies.get(STEP_UP_COOKIE)?.value;
  if (!token) return false;
  const parsed = parseSignedToken(token);
  return (
    parsed?.kind === "step-up" &&
    parsed.userId === userId &&
    parsed.purpose === purpose
  );
}
