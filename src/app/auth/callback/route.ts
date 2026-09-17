import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUserLoginBlocked } from "@/lib/auth/blocked-login";
import { resolveSafeNextPath } from "@/lib/auth/safe-redirect";
import {
  attachStepUpCookie,
  isStepUpPurpose,
  verifyStepUpInitToken,
} from "@/lib/auth/step-up-auth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = resolveSafeNextPath(searchParams.get("next"), "/dashboard");
  const reauthPurpose = searchParams.get("reauth");
  const stepUpInit = searchParams.get("stepUpInit");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  if (await isUserLoginBlocked(data.user.id)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=account_blocked`);
  }

  if (isStepUpPurpose(reauthPurpose)) {
    if (
      !stepUpInit ||
      !verifyStepUpInitToken(stepUpInit, data.user.id, reauthPurpose)
    ) {
      // Step-up identity mismatch: the OAuth login resolved to a different
      // account than the one that initiated step-up. Do NOT leave the swapped
      // session active — sign out so the victim returns to a logged-out state.
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=session_expired`);
    }

    const response = NextResponse.redirect(`${origin}${next}`);
    attachStepUpCookie(response, data.user.id, reauthPurpose);
    return response;
  }

  return NextResponse.redirect(`${origin}${next}`);
}
