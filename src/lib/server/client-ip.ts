import type { NextRequest } from "next/server";
import crypto from "crypto";
import { requireIpHashSalt } from "@/lib/config/env-security";
import { getGuestSessionIdFromRequest } from "@/lib/privacy/guest-session";

function allowTrustedProxyHeaders(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const onVercel =
    process.env.VERCEL === "1" &&
    Boolean(process.env.VERCEL_ENV?.trim()) &&
    Boolean(process.env.VERCEL_URL?.trim());
  return onVercel || process.env.TRUSTED_PROXY_IP_HEADERS === "1";
}

/**
 * Client IP from platform-trusted headers only (Vercel, Cloudflare).
 * Production hosts without Vercel or TRUSTED_PROXY_IP_HEADERS ignore spoofable headers.
 */
export function getTrustedClientIp(request: NextRequest): string {
  if (allowTrustedProxyHeaders()) {
    const vercelIp = request.headers.get("x-real-ip");
    if (vercelIp?.trim()) return vercelIp.trim();

    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp?.trim()) return cfIp.trim();
  }

  if (process.env.NODE_ENV === "development") {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim() || "127.0.0.1";
    return "127.0.0.1";
  }

  return "unknown";
}

export function hashClientIp(ip: string): string {
  const salt = requireIpHashSalt();
  return crypto
    .createHash("sha256")
    .update(`${salt}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

export function getGuestUsageKey(request: NextRequest): string {
  const ip = getTrustedClientIp(request);
  if (ip !== "unknown") return hashClientIp(ip);

  const guestSession = getGuestSessionIdFromRequest(request) || "anonymous";
  return hashClientIp(`unknown:${guestSession}`);
}
