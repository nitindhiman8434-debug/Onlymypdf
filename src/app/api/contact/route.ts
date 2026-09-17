import { NextRequest, NextResponse } from "next/server";
import { sendContactEmail } from "@/lib/email/contact-mailer";
import {
  checkContactEmailRateLimit,
  checkContactRateLimit,
  rateLimitResponse,
} from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { validateContactPayload } from "@/lib/validation/contact-validation";
import { captureApiError, toSafeApiError } from "@/lib/server/safe-error";
import { guardTurnstileRequest } from "@/lib/security/verify-turnstile-request";

export async function POST(request: NextRequest) {
  const rate = await checkContactRateLimit(request);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);

  const originBlocked = guardMutationOrigin(request);
  if (originBlocked) return originBlocked;

  try {
    const body = (await request.json()) as Parameters<typeof validateContactPayload>[0] & {
      turnstileToken?: string;
    };

    const turnstileBlocked = await guardTurnstileRequest(request, body.turnstileToken);
    if (turnstileBlocked) return turnstileBlocked;

    const validated = validateContactPayload(body);

    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: validated.status });
    }

    const emailRate = await checkContactEmailRateLimit(request, validated.data.email);
    if (!emailRate.allowed) return rateLimitResponse(emailRate.retryAfterSec);

    const result = await sendContactEmail(validated.data);

    return NextResponse.json({
      success: true,
      delivered: result.delivered,
      mode: result.mode,
    });
  } catch (err) {
    captureApiError(err, { route: "contact" });
    const message = toSafeApiError(err, "Failed to send message");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
