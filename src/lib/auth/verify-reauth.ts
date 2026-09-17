import type { NextRequest } from "next/server";
import { createEphemeralClient } from "@/lib/supabase/server";
import { isLocalDevAuthEnabled, localDevSignIn } from "@/lib/auth/local-dev-auth";
import { type StepUpPurpose, verifyStepUpCookie } from "@/lib/auth/step-up-auth";

/** Confirm the current user knows their password before destructive actions (GDPR erasure). */
export async function verifyUserReauth(
  email: string,
  password: string
): Promise<boolean> {
  if (!password || password.length < 8) return false;

  if (isLocalDevAuthEnabled()) {
    try {
      await localDevSignIn({ email, password });
      return true;
    } catch {
      return false;
    }
  }

  // Verify the password on an ephemeral client so the caller's existing
  // (AAL2) session cookies are never overwritten with a fresh AAL1 session.
  const supabase = createEphemeralClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

/** Password re-auth or recent OAuth step-up cookie for sensitive account actions. */
export async function verifyUserStepUp(options: {
  request: NextRequest;
  userId: string;
  email: string;
  purpose: StepUpPurpose;
  password?: string;
}): Promise<boolean> {
  if (verifyStepUpCookie(options.request, options.userId, options.purpose)) {
    return true;
  }

  const password = options.password?.trim() ?? "";
  if (!password) return false;

  return verifyUserReauth(options.email, password);
}
