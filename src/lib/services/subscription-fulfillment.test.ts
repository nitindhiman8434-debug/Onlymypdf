import { beforeEach, describe, expect, it, vi } from "vitest";
import { fulfillSubscriptionCharge } from "@/lib/services/subscription-fulfillment.service";

vi.mock("@/lib/db/queries", () => ({
  getPaymentByRazorpayPaymentId: vi.fn(),
  claimPaymentForFulfillment: vi.fn(),
  finalizeClaimedPayment: vi.fn(),
  releasePaymentClaim: vi.fn(),
  getPlanUuidByName: vi.fn(),
  getUserSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  createSubscription: vi.fn(),
  updateUserProfile: vi.fn(),
  createPayment: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/billing/invoice.service", () => ({
  issueGstInvoiceForPayment: vi.fn(async () => ({ invoiceId: "inv-1", invoiceNumber: "OMP-1" })),
}));

vi.mock("@/lib/services/payment.service", () => ({
  verifyRazorpaySubscriptionPaymentBinding: vi.fn(async () => ({
    ok: true,
    amountPaise: 29900,
    paymentMethod: "upi",
  })),
}));

import {
  claimPaymentForFulfillment,
  finalizeClaimedPayment,
  getPaymentByRazorpayPaymentId,
  getPlanUuidByName,
  getUserSubscription,
  releasePaymentClaim,
  createSubscription,
  updateUserProfile,
} from "@/lib/db/queries";
import { createServiceClient } from "@/lib/supabase/server";

function supabaseChain(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  const next = () => query;
  for (const method of [
    "select",
    "eq",
    "in",
    "order",
    "limit",
    "not",
    "is",
    "gt",
    "lt",
    "update",
    "insert",
    "delete",
  ]) {
    query[method] = vi.fn(next);
  }
  query.maybeSingle = vi.fn(async () => result);
  query.single = vi.fn(async () => result);
  query.then = (
    resolve: (value: { data: unknown; error: unknown }) => unknown,
    reject?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);
  return query;
}

describe("fulfillSubscriptionCharge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPaymentByRazorpayPaymentId).mockResolvedValue(null);
    vi.mocked(getPlanUuidByName).mockResolvedValue("plan-uuid");
    vi.mocked(getUserSubscription).mockResolvedValue(null);
    vi.mocked(createSubscription).mockResolvedValue({ id: "sub-1" } as never);
    vi.mocked(finalizeClaimedPayment).mockResolvedValue({ id: "pay-1" } as never);
    vi.mocked(updateUserProfile).mockResolvedValue(undefined as never);
    vi.mocked(releasePaymentClaim).mockResolvedValue(undefined as never);

    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "subscriptions") {
          return supabaseChain({ data: null, error: null });
        }
        return supabaseChain({
          data: {
            id: "pay-row-1",
            user_id: "user-1",
            status: "pending",
            amount: 299,
            plan_name: "pro",
            plan_duration: "monthly",
          },
          error: null,
        });
      }),
    } as never);

    vi.mocked(claimPaymentForFulfillment).mockResolvedValue({
      id: "pay-row-1",
      user_id: "user-1",
      status: "processing",
      amount: 299,
      plan_name: "pro",
      plan_duration: "monthly",
    } as never);
  });

  it("rejects subscription amount mismatch", async () => {
    const result = await fulfillSubscriptionCharge({
      razorpaySubscriptionId: "sub_rzp_1",
      razorpayPaymentId: "pay_rzp_1",
      amountPaise: 100,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Payment amount mismatch");
      expect(result.status).toBe(400);
    }
    expect(releasePaymentClaim).toHaveBeenCalledWith("pay-row-1");
    expect(finalizeClaimedPayment).not.toHaveBeenCalled();
  });

  it("fulfills when subscription amount matches pending payment", async () => {
    const result = await fulfillSubscriptionCharge({
      razorpaySubscriptionId: "sub_rzp_1",
      razorpayPaymentId: "pay_rzp_1",
      amountPaise: 29900,
    });

    expect(result.ok).toBe(true);
    expect(finalizeClaimedPayment).toHaveBeenCalled();
  });
});

describe("cancelLocalSubscription", () => {
  it("marks subscription cancelled in Supabase", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({ update }),
    } as never);

    const { cancelLocalSubscription } = await import("@/lib/services/subscription-fulfillment.service");
    await cancelLocalSubscription("sub_rzp_cancel_1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelled_at: expect.any(String),
      })
    );
  });
});
