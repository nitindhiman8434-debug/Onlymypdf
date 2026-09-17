import { describe, expect, it, vi, beforeEach } from "vitest";
import { fulfillPendingPayment } from "@/lib/services/payment-fulfillment.service";

vi.mock("@/lib/db/queries", () => ({
  getPaymentByRazorpayPaymentId: vi.fn(),
  getPaymentByRazorpayOrderId: vi.fn(),
  getPlanUuidByName: vi.fn(),
  createSubscription: vi.fn(),
  updatePayment: vi.fn(),
  updateUserProfile: vi.fn(),
  incrementCouponUsage: vi.fn(),
  decrementCouponUsage: vi.fn(),
  claimPaymentForFulfillment: vi.fn(),
  finalizeClaimedPayment: vi.fn(),
  releasePaymentClaim: vi.fn(),
  markCouponRedeemed: vi.fn(),
  getUserProfile: vi.fn(),
  getUserSubscription: vi.fn(),
  updateSubscription: vi.fn(),
}));

vi.mock("@/lib/services/payment.service", () => ({
  verifyPayment: vi.fn(() => true),
}));

vi.mock("@/lib/billing/invoice.service", () => ({
  issueGstInvoiceForPayment: vi.fn(async () => ({ invoiceId: "inv-1", invoiceNumber: "OMP-2026-00001" })),
}));

import {
  getPaymentByRazorpayPaymentId,
  getPaymentByRazorpayOrderId,
  getPlanUuidByName,
  createSubscription,
  updateUserProfile,
  incrementCouponUsage,
  claimPaymentForFulfillment,
  finalizeClaimedPayment,
  getUserProfile,
  getUserSubscription,
} from "@/lib/db/queries";

describe("fulfillPendingPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPaymentByRazorpayPaymentId).mockResolvedValue(null);
    vi.mocked(getPaymentByRazorpayOrderId).mockResolvedValue({
      id: "pay-1",
      user_id: "user-1",
      status: "pending",
      amount: 299,
      plan_name: "pro",
      plan_duration: "monthly",
      coupon_code: null,
    } as never);
    vi.mocked(getPlanUuidByName).mockResolvedValue("plan-uuid");
    vi.mocked(createSubscription).mockResolvedValue({ id: "sub-1" } as never);
    vi.mocked(claimPaymentForFulfillment).mockResolvedValue({
      id: "pay-1",
      user_id: "user-1",
      status: "processing",
      amount: 299,
      plan_name: "pro",
      plan_duration: "monthly",
      coupon_code: null,
    } as never);
    vi.mocked(finalizeClaimedPayment).mockResolvedValue({ id: "pay-1" } as never);
    vi.mocked(updateUserProfile).mockResolvedValue(undefined as never);
    vi.mocked(getUserProfile).mockResolvedValue({ plan: "free" } as never);
    vi.mocked(getUserSubscription).mockResolvedValue(null);
    vi.mocked(incrementCouponUsage).mockResolvedValue(true);
  });

  it("rejects amount mismatch from webhook", async () => {
    const result = await fulfillPendingPayment({
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      amount: 100,
      requireSignature: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Payment amount mismatch");
      expect(result.status).toBe(400);
    }
  });

  it("rejects INR capture amount when order is stored in INR (verify-route bug)", async () => {
    const result = await fulfillPendingPayment({
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      amount: 299,
      requireSignature: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Payment amount mismatch");
    }
  });

  it("fulfills when amount matches pending order", async () => {
    const result = await fulfillPendingPayment({
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      amount: 29900,
      requireSignature: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.already_verified).toBe(false);
    expect(claimPaymentForFulfillment).toHaveBeenCalledWith("pay-1");
    expect(finalizeClaimedPayment).toHaveBeenCalled();
  });

  it("resumes processing payment when claim loses race", async () => {
    vi.mocked(claimPaymentForFulfillment).mockResolvedValue(null);
    vi.mocked(getPaymentByRazorpayOrderId)
      .mockResolvedValueOnce({
        id: "pay-1",
        user_id: "user-1",
        status: "pending",
        amount: 299,
        plan_name: "pro",
        plan_duration: "monthly",
        coupon_code: null,
      } as never)
      .mockResolvedValueOnce({
        id: "pay-1",
        user_id: "user-1",
        status: "processing",
        amount: 299,
        plan_name: "pro",
        plan_duration: "monthly",
        coupon_code: null,
      } as never);

    const result = await fulfillPendingPayment({
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      amount: 29900,
      requireSignature: false,
    });

    expect(result.ok).toBe(true);
    expect(createSubscription).toHaveBeenCalled();
  });

  it("rejects fulfillment when coupon usage is exhausted", async () => {
    vi.mocked(getPaymentByRazorpayOrderId).mockResolvedValue({
      id: "pay-1",
      user_id: "user-1",
      status: "pending",
      amount: 99,
      plan_name: "pro",
      plan_duration: "monthly",
      coupon_code: "SAVE50",
    } as never);
    vi.mocked(claimPaymentForFulfillment).mockResolvedValue({
      id: "pay-1",
      user_id: "user-1",
      status: "processing",
      amount: 99,
      plan_name: "pro",
      plan_duration: "monthly",
      coupon_code: "SAVE50",
    } as never);
    vi.mocked(incrementCouponUsage).mockResolvedValue(false);

    const result = await fulfillPendingPayment({
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      amount: 9900,
      requireSignature: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Coupon is no longer available");
      expect(result.status).toBe(409);
    }
    expect(updateUserProfile).not.toHaveBeenCalled();
  });
});
