import { NextRequest, NextResponse } from "next/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { createClient } from "@/lib/supabase/server";
import { toSafeApiError } from "@/lib/server/safe-error";
import { authGuardResponse } from "@/lib/server/auth-guard-http";
import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";
import { resolveMfaAssurance } from "@/lib/auth/mfa-assurance";

export async function GET(request: NextRequest) {
  const rateLimited = await guardGeneralApiRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const auth = await tryGetApiUser({ skipMfaAssurance: true });
    if (!auth.ok) return auth.response;

    const supabase = await createClient();
    const assurance = await resolveMfaAssurance(supabase);

    if (assurance.requiresMfaVerification) {
      return NextResponse.json({
        enabled: true,
        pendingVerification: true,
        factors: [],
      });
    }

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const verified = (data.totp ?? []).filter((f) => f.status === "verified");
    return NextResponse.json({
      enabled: verified.length > 0,
      factors: verified.map((f) => ({
        id: f.id,
        friendlyName: f.friendly_name,
        createdAt: f.created_at,
      })),
    });
  } catch (err) {
    const guarded = authGuardResponse(err);
    if (guarded) return guarded;
    return NextResponse.json({ error: toSafeApiError(err, "Failed to load MFA status") }, { status: 500 });
  }
}
