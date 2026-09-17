import { type NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/payment.service", () => ({
  verifyWebhookSignature: vi.fn(),
  fetchRazorpayPayment: vi.fn(),
  verifyRazorpaySubscriptionPaymentBinding: vi.fn(),
}));

vi.mock("@/lib/services/payment-fulfillment.service", () => ({
  fulfillPendingPayment: vi.fn(),
}));

vi.mock("@/lib/services/payment-webhook-handlers.service", () => ({
  handlePaymentFailedWebhook: vi.fn(),
  handlePaymentRefundedWebhook: vi.fn(),
  handleSubscriptionHaltedWebhook: vi.fn(),
}));

vi.mock("@/lib/services/subscription-fulfillment.service", () => ({
  fulfillSubscriptionCharge: vi.fn(),
  cancelLocalSubscription: vi.fn(),
}));

vi.mock("@/lib/enterprise/org-billing.service", () => ({
  renewOrganizationPlanFromWebhook: vi.fn(),
  clearOrganizationAutoRenewByRazorpaySub: vi.fn(),
}));

vi.mock("@/lib/server/rate-limiter", () => ({
  guardWebhookRateLimit: vi.fn(),
}));

vi.mock("@/lib/server/safe-error", () => ({
  captureApiError: vi.fn(),
}));

vi.mock("@/lib/services/payment-reconciliation.service", () => ({
  claimWebhookEvent: vi.fn(),
  recordPaymentReconciliation: vi.fn(),
  releaseWebhookEvent: vi.fn(),
}));

import { verifyWebhookSignature, fetchRazorpayPayment, verifyRazorpaySubscriptionPaymentBinding } from "@/lib/services/payment.service";
import { fulfillPendingPayment } from "@/lib/services/payment-fulfillment.service";
import {
  handlePaymentFailedWebhook,
  handlePaymentRefundedWebhook,
  handleSubscriptionHaltedWebhook,
} from "@/lib/services/payment-webhook-handlers.service";
import {
  cancelLocalSubscription,
  fulfillSubscriptionCharge,
} from "@/lib/services/subscription-fulfillment.service";
import {
  clearOrganizationAutoRenewByRazorpaySub,
  renewOrganizationPlanFromWebhook,
} from "@/lib/enterprise/org-billing.service";
import { guardWebhookRateLimit } from "@/lib/server/rate-limiter";
import { claimWebhookEvent, releaseWebhookEvent } from "@/lib/services/payment-reconciliation.service";
import { POST as webhookPOST } from "@/app/api/payments/webhook/route";

function webhookRequest(
  body: string,
  signature?: string,
  extraHeaders?: Record<string, string>
): NextRequest {
  return {
    text: vi.fn().mockResolvedValue(body),
    headers: new Headers({
      ...(signature ? { "x-razorpay-signature": signature } : {}),
      ...extraHeaders,
    }),
  } as unknown as NextRequest;
}

describe("payments webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardWebhookRateLimit).mockResolvedValue(null);
    vi.mocked(verifyWebhookSignature).mockReturnValue(true);
    vi.mocked(fulfillPendingPayment).mockResolvedValue({ ok: true, already_verified: false });
    vi.mocked(fulfillSubscriptionCharge).mockResolvedValue({ ok: true, already_verified: false });
    vi.mocked(renewOrganizationPlanFromWebhook).mockResolvedValue(false);
    vi.mocked(clearOrganizationAutoRenewByRazorpaySub).mockResolvedValue(false);
    vi.mocked(claimWebhookEvent).mockResolvedValue("new");
    vi.mocked(releaseWebhookEvent).mockResolvedValue(undefined);
    vi.mocked(fetchRazorpayPayment).mockImplementation(async (id: string) => ({
      id,
      status: "captured",
    }));
    vi.mocked(verifyRazorpaySubscriptionPaymentBinding).mockResolvedValue({
      ok: true,
    });
  });

  it("rejects missing webhook signature", async () => {
    const response = await webhookPOST(webhookRequest("{}"));
    expect(response.status).toBe(400);
  });

  it("rejects invalid webhook signature", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(false);

    const response = await webhookPOST(webhookRequest("{}", "bad-signature"));
    expect(response.status).toBe(400);
  });

  it("fulfills payment.captured events", async () => {
    const payload = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_rzp_1",
            order_id: "order_rzp_1",
            amount: 29900,
            method: "card",
          },
        },
      },
    });

    const response = await webhookPOST(webhookRequest(payload, "sig"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.received).toBe(true);
    expect(fulfillPendingPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        razorpay_order_id: "order_rzp_1",
        razorpay_payment_id: "pay_rzp_1",
        amount: 29900,
        requireSignature: false,
      })
    );
  });

  it("handles payment.failed events", async () => {
    const payload = JSON.stringify({
      event: "payment.failed",
      payload: {
        payment: {
          entity: { id: "pay_rzp_2", order_id: "order_rzp_2" },
        },
      },
    });

    const response = await webhookPOST(webhookRequest(payload, "sig"));
    expect(response.status).toBe(200);
    expect(handlePaymentFailedWebhook).toHaveBeenCalled();
  });

  it("handles refund.processed events", async () => {
    const payload = JSON.stringify({
      event: "refund.processed",
      payload: {
        refund: { entity: { payment_id: "pay_rzp_3" } },
      },
    });

    const response = await webhookPOST(webhookRequest(payload, "sig"));
    expect(response.status).toBe(200);
    expect(handlePaymentRefundedWebhook).toHaveBeenCalledWith("pay_rzp_3");
  });

  it("fulfills subscription.charged events", async () => {
    const payload = JSON.stringify({
      event: "subscription.charged",
      payload: {
        payment: {
          entity: {
            id: "pay_rzp_4",
            amount: 29900,
            method: "upi",
            subscription_id: "sub_rzp_1",
          },
        },
        subscription: { entity: { id: "sub_rzp_1" } },
      },
    });

    const response = await webhookPOST(webhookRequest(payload, "sig"));
    expect(response.status).toBe(200);
    expect(fulfillSubscriptionCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        razorpaySubscriptionId: "sub_rzp_1",
        razorpayPaymentId: "pay_rzp_4",
        amountPaise: 29900,
      })
    );
  });

  it("handles subscription.halted events", async () => {
    const payload = JSON.stringify({
      event: "subscription.halted",
      payload: {
        subscription: { entity: { id: "sub_rzp_2" } },
      },
    });

    const response = await webhookPOST(webhookRequest(payload, "sig"));
    expect(response.status).toBe(200);
    expect(handleSubscriptionHaltedWebhook).toHaveBeenCalledWith("sub_rzp_2");
  });

  it("cancels local subscription on subscription.cancelled", async () => {
    const payload = JSON.stringify({
      event: "subscription.cancelled",
      payload: {
        subscription: { entity: { id: "sub_rzp_3" } },
      },
    });

    const response = await webhookPOST(webhookRequest(payload, "sig"));
    expect(response.status).toBe(200);
    expect(cancelLocalSubscription).toHaveBeenCalledWith("sub_rzp_3");
  });

  it("releases the event claim when captured payment fulfillment fails", async () => {
    vi.mocked(fulfillPendingPayment).mockResolvedValue({
      ok: false,
      status: 500,
      error: "db down",
    });
    const payload = JSON.stringify({
      event: "payment.captured",
      id: "evt_1",
      payload: {
        payment: {
          entity: {
            id: "pay_rzp_1",
            order_id: "order_rzp_1",
            amount: 29900,
            method: "card",
          },
        },
      },
    });

    const response = await webhookPOST(
      webhookRequest(payload, "sig", { "x-razorpay-event-id": "evt_1" })
    );

    expect(response.status).toBe(500);
    expect(releaseWebhookEvent).toHaveBeenCalledWith("evt_1");
  });
});
