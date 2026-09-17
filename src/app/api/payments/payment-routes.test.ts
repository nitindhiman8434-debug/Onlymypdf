import { NextResponse, type NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/auth/get-api-user", () => ({
  getAuthenticatedSupabaseUser: vi.fn(),
  tryGetApiUser: vi.fn(),
}));

vi.mock("@/lib/services/payment.service", () => ({
  createOrder: vi.fn(),
  createRazorpaySubscription: vi.fn(),
  cancelRazorpaySubscription: vi.fn(),
  getRazorpayPlanId: vi.fn(),
  isRazorpaySubscriptionEnabled: vi.fn(),
  fetchRazorpayPayment: vi.fn(),
  verifyRazorpaySubscriptionPaymentBinding: vi.fn(),
}));

vi.mock("@/lib/billing/billing-config", () => ({
  isBillingCheckoutAvailable: vi.fn(),
  isMockBillingMode: vi.fn(),
}));

vi.mock("@/lib/billing/mock-billing.service", () => ({
  createMockPaymentId: vi.fn(),
  createMockPaymentSignature: vi.fn(),
  isMockOrderId: vi.fn(),
  isMockSubscriptionId: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
  createPayment: vi.fn(),
  getCouponCode: vi.fn(),
  getPaymentByRazorpayOrderId: vi.fn(),
}));

vi.mock("@/lib/server/rate-limiter", () => ({
  checkAuthRateLimit: vi.fn(),
  checkCouponAttemptRateLimit: vi.fn(),
  rateLimitResponse: vi.fn((retryAfterSec: number) =>
    NextResponse.json({ error: "rate limited", retryAfterSec }, { status: 429 })
  ),
}));

vi.mock("@/lib/server/mutation-origin", () => ({
  guardMutationOrigin: vi.fn(),
}));

vi.mock("@/lib/server/safe-error", () => ({
  toSafeApiError: vi.fn((_err: unknown, fallback: string) => fallback),
  captureApiError: vi.fn(),
}));

vi.mock("@/lib/server/auth-guard-http", () => ({
  authGuardResponse: vi.fn(),
}));

vi.mock("@/lib/services/payment-fulfillment.service", () => ({
  fulfillPendingPayment: vi.fn(),
}));

vi.mock("@/lib/services/subscription-fulfillment.service", () => ({
  fulfillSubscriptionCharge: vi.fn(),
  cancelLocalSubscription: vi.fn(),
}));

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAuthenticatedSupabaseUser, tryGetApiUser } from "@/lib/auth/get-api-user";
import {
  createOrder,
  createRazorpaySubscription,
  getRazorpayPlanId,
  isRazorpaySubscriptionEnabled,
  verifyRazorpaySubscriptionPaymentBinding,
} from "@/lib/services/payment.service";
import { isBillingCheckoutAvailable, isMockBillingMode } from "@/lib/billing/billing-config";
import {
  createMockPaymentId,
  createMockPaymentSignature,
  isMockOrderId,
} from "@/lib/billing/mock-billing.service";
import { createPayment, getCouponCode, getPaymentByRazorpayOrderId } from "@/lib/db/queries";
import { checkAuthRateLimit, checkCouponAttemptRateLimit } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { fulfillPendingPayment } from "@/lib/services/payment-fulfillment.service";
import { fulfillSubscriptionCharge } from "@/lib/services/subscription-fulfillment.service";
import { POST as createOrderPOST } from "@/app/api/payments/create-order/route";
import { POST as createSubscriptionPOST } from "@/app/api/payments/create-subscription/route";
import { POST as mockCompletePOST } from "@/app/api/payments/mock-complete/route";
import { POST as verifyPOST } from "@/app/api/payments/verify/route";
import { POST as verifySubscriptionPOST } from "@/app/api/payments/verify-subscription/route";

function requestJson(body: unknown): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(),
  } as unknown as NextRequest;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("payment route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardMutationOrigin).mockReturnValue(null);
    vi.mocked(checkAuthRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 99,
      retryAfterSec: 0,
    });
    vi.mocked(checkCouponAttemptRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 99,
      retryAfterSec: 0,
    });
    vi.mocked(createClient).mockResolvedValue({} as never);
    vi.mocked(getAuthenticatedSupabaseUser).mockResolvedValue({
      id: "user-1",
      email: "buyer@example.com",
    } as never);
    vi.mocked(tryGetApiUser).mockResolvedValue({
      ok: true,
      user: { id: "user-1", email: "buyer@example.com", plan: "pro" },
    } as never);
    vi.mocked(isBillingCheckoutAvailable).mockReturnValue(true);
    vi.mocked(isMockBillingMode).mockReturnValue(false);
    vi.mocked(isRazorpaySubscriptionEnabled).mockReturnValue(true);
    vi.mocked(getRazorpayPlanId).mockReturnValue("plan_yearly");
    vi.mocked(createMockPaymentId).mockReturnValue("pay_mock_1");
    vi.mocked(createMockPaymentSignature).mockReturnValue("mock_sig");
    vi.mocked(isMockOrderId).mockReturnValue(true);
  });

  it("creates discounted yearly Razorpay orders and stores INR amount", async () => {
    vi.mocked(getCouponCode).mockResolvedValue({
      code: "HALF",
      discount_percent: 50,
    } as never);
    vi.mocked(createOrder).mockResolvedValue({
      id: "order_1",
      amount: 119950,
      currency: "INR",
    } as never);

    const response = await createOrderPOST(
      requestJson({ plan: "pro", duration: "yearly", couponCode: "HALF" })
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.amount).toBe(119950);
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1199.5,
        currency: "INR",
        plan_duration: "yearly",
        coupon_code: "HALF",
      })
    );
  });

  it("verifies yearly orders using paise amount derived from INR storage", async () => {
    vi.mocked(getPaymentByRazorpayOrderId).mockResolvedValue({
      id: "pay-1",
      user_id: "user-1",
      amount: 2399,
    } as never);
    vi.mocked(fulfillPendingPayment).mockResolvedValue({
      ok: true,
      already_verified: false,
      payment_id: "pay-1",
      subscription_id: "sub-1",
    } as never);

    const response = await verifyPOST(
      requestJson({
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_rzp_1",
        razorpay_signature: "sig",
      })
    );

    expect(response.status).toBe(200);
    expect(fulfillPendingPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 239900,
        requireSignature: true,
      })
    );
  });

  it("verifies owned subscription payments with amount cross-check", async () => {
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { user_id: "user-1", amount: 299 },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    } as never);
    vi.mocked(verifyRazorpaySubscriptionPaymentBinding).mockResolvedValue({
      ok: true,
      amountPaise: 29900,
      paymentMethod: "upi",
    });
    vi.mocked(fulfillSubscriptionCharge).mockResolvedValue({
      ok: true,
      already_verified: false,
    } as never);

    const response = await verifySubscriptionPOST(
      requestJson({
        razorpay_subscription_id: "sub_rzp_1",
        razorpay_payment_id: "pay_rzp_1",
      })
    );

    expect(response.status).toBe(200);
    expect(fulfillSubscriptionCharge).toHaveBeenCalledWith({
      razorpaySubscriptionId: "sub_rzp_1",
      razorpayPaymentId: "pay_rzp_1",
      amountPaise: 29900,
    });
  });

  it("rejects subscription verify when Razorpay amount mismatches pending payment", async () => {
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { user_id: "user-1", amount: 299 },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    } as never);
    vi.mocked(verifyRazorpaySubscriptionPaymentBinding).mockResolvedValue({
      ok: true,
      amountPaise: 100,
      paymentMethod: "upi",
    });

    const response = await verifySubscriptionPOST(
      requestJson({
        razorpay_subscription_id: "sub_rzp_1",
        razorpay_payment_id: "pay_rzp_1",
      })
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe("Payment amount mismatch");
    expect(fulfillSubscriptionCharge).not.toHaveBeenCalled();
  });

  it("creates yearly subscription payments with INR storage", async () => {
    vi.mocked(createRazorpaySubscription).mockResolvedValue({
      id: "sub_rzp_1",
    } as never);

    const response = await createSubscriptionPOST(requestJson({ duration: "yearly" }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      subscription_id: "sub_rzp_1",
      amount: 239900,
      currency: "INR",
      duration: "yearly",
    });
    expect(createRazorpaySubscription).toHaveBeenCalledWith({
      planId: "plan_yearly",
      totalCount: 10,
      notes: {
        user_id: "user-1",
        duration: "yearly",
        plan: "pro",
      },
    });
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        razorpay_subscription_id: "sub_rzp_1",
        amount: 2399,
        billing_mode: "subscription",
      })
    );
  });

  it("rejects invalid subscription duration", async () => {
    const response = await createSubscriptionPOST(requestJson({ duration: "weekly" }));
    expect(response.status).toBe(400);
  });

  it("completes mock one-time orders using normalized stored amount", async () => {
    vi.mocked(isMockBillingMode).mockReturnValue(true);
    vi.mocked(getPaymentByRazorpayOrderId).mockResolvedValue({
      id: "pay-1",
      user_id: "user-1",
      amount: 2399,
    } as never);
    vi.mocked(fulfillPendingPayment).mockResolvedValue({
      ok: true,
      already_verified: false,
    } as never);

    const response = await mockCompletePOST(
      requestJson({ type: "order", razorpay_order_id: "order_mock_1" })
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      mock: true,
      razorpay_payment_id: "pay_mock_1",
    });
    expect(fulfillPendingPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 239900,
        payment_method: "mock",
        requireSignature: true,
      })
    );
  });
});
