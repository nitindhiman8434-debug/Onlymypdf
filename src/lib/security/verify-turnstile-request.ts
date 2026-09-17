import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getTrustedClientIp } from "@/lib/server/client-ip";
import { isTurnstileConfigured, verifyTurnstileToken } from "@/lib/security/turnstile";

/** Returns a 4xx/503 response when Turnstile verification fails; null when OK to proceed. */
export async function guardTurnstileRequest(
  request: NextRequest,
  turnstileToken: string | undefined
): Promise<NextResponse | null> {
  if (!isTurnstileConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Security verification is not configured." },
        { status: 503 }
      );
    }
    return null;
  }

  const captchaOk = await verifyTurnstileToken(turnstileToken, getTrustedClientIp(request));
  if (!captchaOk) {
    return NextResponse.json(
      { error: "Security verification failed. Please try again." },
      { status: 400 }
    );
  }

  return null;
}
