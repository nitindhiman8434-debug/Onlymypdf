import type { NextRequest } from "next/server";

export const GUEST_SESSION_COOKIE = "pd_guest_session";

/** Guest identity for authorization — httpOnly cookie only (no client header spoofing). */
export function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get(GUEST_SESSION_COOKIE)?.value?.trim() || null;
}

/** Label for usage logs when guest cookie is absent. */
export function getGuestSessionLabel(request: NextRequest): string {
  return getGuestSessionIdFromRequest(request) || "anonymous";
}
