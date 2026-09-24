import { NextRequest, NextResponse } from "next/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import {
  checkCustomerFeedbackRateLimit,
  guardGeneralApiRateLimit,
  rateLimitResponse,
} from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { captureApiError, toSafeApiError } from "@/lib/server/safe-error";
import {
  createCustomerFeedback,
  CustomerFeedbackError,
  deleteCustomerFeedback,
  getCustomerFeedbackContext,
} from "@/lib/services/customer-feedback.service";
import {
  type CustomerFeedbackPayload,
  validateCustomerFeedback,
} from "@/lib/validation/customer-feedback-validation";

export async function GET(request: NextRequest) {
  const rateLimited = await guardGeneralApiRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const context = await getCustomerFeedbackContext(auth.user.id);
    return NextResponse.json(context);
  } catch (error) {
    captureApiError(error, { route: "feedback", method: "GET" });
    return NextResponse.json({ error: "Failed to load feedback." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const originBlocked = guardMutationOrigin(request);
  if (originBlocked) return originBlocked;

  try {
    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;

    const rate = await checkCustomerFeedbackRateLimit(request, auth.user.id);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec, request);

    const body = (await request.json().catch(() => ({}))) as CustomerFeedbackPayload;
    const validated = validateCustomerFeedback(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: validated.status });
    }

    const feedback = await createCustomerFeedback(auth.user.id, validated.data);
    return NextResponse.json({ success: true, feedback }, { status: 201 });
  } catch (error) {
    if (error instanceof CustomerFeedbackError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    captureApiError(error, { route: "feedback", method: "POST" });
    return NextResponse.json(
      { error: toSafeApiError(error, "Failed to save feedback.") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const originBlocked = guardMutationOrigin(request);
  if (originBlocked) return originBlocked;

  try {
    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;

    const rate = await checkCustomerFeedbackRateLimit(request, auth.user.id);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec, request);

    const body = (await request.json().catch(() => ({}))) as { feedbackId?: string };
    const feedbackId = body.feedbackId?.trim() ?? "";
    if (!feedbackId) {
      return NextResponse.json({ error: "feedbackId is required." }, { status: 400 });
    }

    await deleteCustomerFeedback(auth.user.id, feedbackId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CustomerFeedbackError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    captureApiError(error, { route: "feedback", method: "DELETE" });
    return NextResponse.json(
      { error: toSafeApiError(error, "Failed to withdraw feedback.") },
      { status: 500 }
    );
  }
}
