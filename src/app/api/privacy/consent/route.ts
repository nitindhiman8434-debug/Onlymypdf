import { NextRequest, NextResponse } from "next/server";
import { CONSENT_VERSION } from "@/lib/privacy/consent";
import { getGuestSessionIdFromRequest } from "@/lib/privacy/guest-session";
import { getUserConsentRecords, logConsentRecord } from "@/lib/db/queries";
import { getGuestUsageKey } from "@/lib/server/client-ip";
import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";

export async function GET(request: NextRequest) {
  const rateLimited = await guardGeneralApiRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const records = await getUserConsentRecords(user.id);
    const latest = records[0] ?? null;

    return NextResponse.json({
      consent: latest
        ? {
            consent_version: latest.consent_version,
            essential: latest.essential,
            analytics: latest.analytics,
            marketing: latest.marketing,
            created_at: latest.created_at,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load consent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rateLimited = await guardGeneralApiRateLimit(request);
  if (rateLimited) return rateLimited;

  const originBlocked = guardMutationOrigin(request);
  if (originBlocked) return originBlocked;

  try {
    const body = (await request.json()) as {
      analytics?: boolean;
      marketing?: boolean;
      consent_version?: string;
    };

    let userId: string | null = null;
    const auth = await tryGetApiUser();
    if (auth.ok) {
      userId = auth.user.id;
    } else if (auth.response.status !== 401) {
      return auth.response;
    }

    await logConsentRecord({
      user_id: userId,
      guest_session_id: getGuestSessionIdFromRequest(request),
      consent_version: CONSENT_VERSION,
      essential: true,
      analytics: Boolean(body.analytics),
      marketing: Boolean(body.marketing),
      ip_hash: getGuestUsageKey(request),
      user_agent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record consent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
