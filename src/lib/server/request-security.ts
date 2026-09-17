import type { NextRequest } from "next/server";
import { buildOwnerHash } from "@/lib/pdf/pdf-session-store";
import { getGuestSessionIdFromRequest } from "@/lib/privacy/guest-session";
import { getGuestUsageKey } from "@/lib/server/client-ip";

/** Stable owner identity for PDF sessions — binds guests to IP + session cookie. */
export function ownerHashFromRequest(
  request: NextRequest,
  userId: string | null
): string {
  if (userId) return buildOwnerHash(userId, null);
  const guestSession = getGuestSessionIdFromRequest(request) || "anonymous";
  const guestKey = `${getGuestUsageKey(request)}:${guestSession}`;
  return buildOwnerHash(null, guestKey);
}

/** Hashed IP for usage logs (never store raw IP). */
export function clientIpForLogs(request: NextRequest): string {
  return getGuestUsageKey(request);
}
