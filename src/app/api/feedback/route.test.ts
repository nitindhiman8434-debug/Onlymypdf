import { type NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/get-api-user", () => ({
  tryGetApiUser: vi.fn(),
}));

vi.mock("@/lib/server/rate-limiter", () => ({
  guardGeneralApiRateLimit: vi.fn(),
  checkCustomerFeedbackRateLimit: vi.fn(),
  rateLimitResponse: vi.fn((retryAfterSec: number) =>
    NextResponse.json({ error: "rate limited", retryAfterSec }, { status: 429 })
  ),
}));

vi.mock("@/lib/server/mutation-origin", () => ({
  guardMutationOrigin: vi.fn(),
}));

vi.mock("@/lib/server/safe-error", () => ({
  captureApiError: vi.fn(),
  toSafeApiError: vi.fn((_error: unknown, fallback: string) => fallback),
}));

vi.mock("@/lib/services/customer-feedback.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/customer-feedback.service")
  >("@/lib/services/customer-feedback.service");
  return {
    CustomerFeedbackError: actual.CustomerFeedbackError,
    getCustomerFeedbackContext: vi.fn(),
    createCustomerFeedback: vi.fn(),
    deleteCustomerFeedback: vi.fn(),
  };
});

import { tryGetApiUser } from "@/lib/auth/get-api-user";
import {
  checkCustomerFeedbackRateLimit,
  guardGeneralApiRateLimit,
} from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import {
  createCustomerFeedback,
  deleteCustomerFeedback,
  getCustomerFeedbackContext,
} from "@/lib/services/customer-feedback.service";
import { DELETE, GET, POST } from "@/app/api/feedback/route";

const JOB_ID = "b3d5e50d-8f36-4eb0-82b8-e691503332a0";
const FEEDBACK_ID = "be83d31b-08e0-47a8-8902-28973a2c934b";

function requestJson(body: unknown): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(),
  } as unknown as NextRequest;
}

function emptyRequest(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest;
}

describe("verified customer feedback routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardGeneralApiRateLimit).mockResolvedValue(null);
    vi.mocked(guardMutationOrigin).mockReturnValue(null);
    vi.mocked(checkCustomerFeedbackRateLimit).mockResolvedValue({
      allowed: true,
      retryAfterSec: 0,
      remaining: 9,
    });
    vi.mocked(tryGetApiUser).mockResolvedValue({
      ok: true,
      user: { id: "user-1", email: "customer@example.com", plan: "free" },
    } as never);
  });

  it("lists only the authenticated user's eligible jobs and feedback context", async () => {
    vi.mocked(getCustomerFeedbackContext).mockResolvedValue({
      jobs: [{ id: JOB_ID, tool_name: "pdf-to-word", status: "completed" }],
      feedback: [],
    } as never);

    const response = await GET(emptyRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ jobs: [{ id: JOB_ID }] });
    expect(getCustomerFeedbackContext).toHaveBeenCalledWith("user-1");
  });

  it("stores consented feedback linked to a completed job", async () => {
    vi.mocked(createCustomerFeedback).mockResolvedValue({ id: FEEDBACK_ID } as never);

    const response = await POST(
      requestJson({
        jobId: JOB_ID,
        overallRating: 5,
        accuracyRating: 4,
        speedRating: 5,
        comment: "The output remained editable and kept the page layout.",
        researchConsent: true,
        publishConsent: false,
      })
    );

    expect(response.status).toBe(201);
    expect(createCustomerFeedback).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ jobId: JOB_ID, publishConsent: false })
    );
  });

  it("rejects storage when research consent is missing", async () => {
    const response = await POST(
      requestJson({
        jobId: JOB_ID,
        overallRating: 5,
        accuracyRating: 5,
        speedRating: 5,
        comment: "This is long enough to be useful feedback.",
        researchConsent: false,
      })
    );

    expect(response.status).toBe(400);
    expect(createCustomerFeedback).not.toHaveBeenCalled();
  });

  it("rate limits feedback mutations per authenticated user", async () => {
    vi.mocked(checkCustomerFeedbackRateLimit).mockResolvedValue({
      allowed: false,
      retryAfterSec: 120,
      remaining: 0,
    });

    const response = await POST(requestJson({}));

    expect(response.status).toBe(429);
    expect(createCustomerFeedback).not.toHaveBeenCalled();
  });

  it("withdraws only through the user-scoped service", async () => {
    vi.mocked(deleteCustomerFeedback).mockResolvedValue(undefined);

    const response = await DELETE(requestJson({ feedbackId: FEEDBACK_ID }));

    expect(response.status).toBe(200);
    expect(deleteCustomerFeedback).toHaveBeenCalledWith("user-1", FEEDBACK_ID);
  });
});
