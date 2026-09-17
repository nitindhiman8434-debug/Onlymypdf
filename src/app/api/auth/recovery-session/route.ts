import { NextRequest, NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isLocalDevAuthEnabled } from "@/lib/auth/local-dev-auth";
import { isPasswordRecoverySession } from "@/lib/auth/recovery-session";
import {
  checkRecoverySessionRateLimit,
  rateLimitResponse,
} from "@/lib/server/rate-limiter";

export async function GET(request: NextRequest) {
  const rate = await checkRecoverySessionRateLimit(request);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);

  if (isLocalDevAuthEnabled() || !isSupabaseConfigured()) {
    return NextResponse.json({ ready: false });
  }

  const supabase = await createClient();
  const ready = await isPasswordRecoverySession(supabase);
  return NextResponse.json({ ready });
}
