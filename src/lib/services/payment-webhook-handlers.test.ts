import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  handlePaymentFailedWebhook,
  handlePaymentRefundedWebhook,
  handleSubscriptionHaltedWebhook,
} from "@/lib/services/payment-webhook-handlers.service";

vi.mock("@/lib/db/queries", () => ({
  getPaymentByRazorpayOrderId: vi.fn(),
  getPaymentByRazorpayPaymentId: vi.fn(),
  updatePayment: vi.fn(),
  updateSubscription: vi.fn(),
  updateUserProfile: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/enterprise/org-access.service", () => ({
  getPrimaryOrganizationForUser: vi.fn(async () => null),
}));

import {
  getPaymentByRazorpayOrderId,
  getPaymentByRazorpayPaymentId,
  updatePayment,
  updateSubscription,
  updateUserProfile,
} from "@/lib/db/queries";
import { createServiceClient } from "@/lib/supabase/server";

function supabaseChain(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  const next = () => query;
  for (const method of ["select", "eq", "in", "order", "limit", "not", "is", "gt", "lt", "update"]) {
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

describe("payment webhook handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks pending payments as failed", async () => {
    vi.mocked(getPaymentByRazorpayOrderId).mockResolvedValue({
      id: "pay-1",
      status: "pending",
      razorpay_payment_id: null,
    } as never);

    const handled = await handlePaymentFailedWebhook({
      id: "rzp_pay_1",
      order_id: "order_1",
    });

    expect(handled).toBe(true);
    expect(updatePayment).toHaveBeenCalledWith("pay-1", {
      status: "failed",
      razorpay_payment_id: "rzp_pay_1",
    });
  });

  it("marks completed payments as refunded and revokes pro access", async () => {
    vi.mocked(getPaymentByRazorpayPaymentId).mockResolvedValue({
      id: "pay-2",
      status: "completed",
      user_id: "user-1",
      plan_name: "pro",
      subscription_id: "sub-1",
    } as never);

    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "billing_invoices") {
          return supabaseChain({ data: { organization_id: null }, error: null });
        }
        if (table === "subscriptions") {
          return supabaseChain({ data: [], error: null });
        }
        return supabaseChain({ data: null, error: null });
      }),
    } as never);

    const handled = await handlePaymentRefundedWebhook("rzp_pay_2");

    expect(handled).toBe(true);
    expect(updatePayment).toHaveBeenCalledWith("pay-2", { status: "refunded" });
    expect(updateSubscription).toHaveBeenCalledWith("sub-1", { status: "cancelled" });
    expect(updateUserProfile).toHaveBeenCalledWith("user-1", {
      plan: "free",
      plan_expires_at: null,
    });
  });

  it("ignores refund events for non-completed payments", async () => {
    vi.mocked(getPaymentByRazorpayPaymentId).mockResolvedValue({
      id: "pay-3",
      status: "failed",
    } as never);

    await expect(handlePaymentRefundedWebhook("rzp_pay_3")).resolves.toBe(false);
    expect(updatePayment).not.toHaveBeenCalled();
  });

  it("marks subscriptions and orgs past_due on halt", async () => {
    function tableMock(rows: Array<{ id: string }>) {
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: rows, error: null }),
            }),
          }),
        }),
      };
    }

    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn((table: string) =>
        table === "subscriptions" ? tableMock([{ id: "sub-1" }]) : tableMock([{ id: "org-1" }])
      ),
    } as never);

    await expect(handleSubscriptionHaltedWebhook("sub_rzp_1")).resolves.toBe(true);
  });
});
