import { getUserProfile } from "@/lib/db/queries";
import { isBlockedProfile, UserBlockedError } from "@/lib/auth/plan-access";

/**
 * Reject suspended accounts on cookie-authenticated routes that call
 * `supabase.auth.getUser()` directly (guest-capable endpoints) instead of
 * `getApiUser()`. No-op for guests. Throws `UserBlockedError` (mapped to 403 by
 * `authGuardResponse` / `handleToolRouteFailure`) when the user is blocked.
 *
 * Fails CLOSED: if the profile cannot be loaded we cannot confirm the account is
 * active, so the error propagates and the request is denied (matches
 * `getApiUser` semantics). Prevents a suspension bypass during DB blips.
 */
export async function assertAccountActive(
  userId: string | null | undefined
): Promise<void> {
  if (!userId) return;

  const profile = await getUserProfile(userId);
  if (profile && isBlockedProfile(profile)) {
    throw new UserBlockedError();
  }
}
