import type { SupabaseClient } from "@supabase/supabase-js";

const RECOVERY_MAX_AGE_SEC = 15 * 60;

type AmrEntry = { method?: string; timestamp?: number };

function parseAccessTokenAmr(accessToken: string): AmrEntry[] | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as { amr?: AmrEntry[] };
    return Array.isArray(payload.amr) ? payload.amr : null;
  } catch {
    return null;
  }
}

/** True when the current session was created via Supabase password-recovery (within 15 min). */
export async function isPasswordRecoverySession(
  supabase: SupabaseClient
): Promise<boolean> {
  // Verify the token with the auth server before trusting any of its claims.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return false;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return false;

  const amr = parseAccessTokenAmr(session.access_token);
  if (!amr?.length) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  return amr.some((entry) => {
    const method = entry.method?.toLowerCase() ?? "";
    if (method !== "otp" && method !== "recovery") {
      return false;
    }
    const ts = entry.timestamp;
    if (typeof ts !== "number") return false;
    const ageSec = nowSec - ts;
    return ageSec >= 0 && ageSec <= RECOVERY_MAX_AGE_SEC;
  });
}
