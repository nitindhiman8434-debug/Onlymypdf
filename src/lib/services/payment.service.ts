import Razorpay from "razorpay";
import crypto from "crypto";
import { isMockBillingMode } from "@/lib/billing/billing-config";
import {
  createMockOrderId,
  createMockPaymentId,
  createMockSubscriptionId,
  isMockOrderId,
  isMockPaymentId,
  isMockSubscriptionId,
  verifyMockPaymentSignature,
} from "@/lib/billing/mock-billing.service";

let razorpayClient: Razorpay | null = null;

function getRazorpayClient(): Razorpay {
  if (!process.env.RAZORPAY_KEY_ID?.trim() || !process.env.RAZORPAY_KEY_SECRET?.trim()) {
    throw new Error("Razorpay is not configured");
  }
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
}

export async function createOrder(amount: number, currency: string = "INR", receipt: string) {
  if (isMockBillingMode()) {
    return {
      id: createMockOrderId(),
      amount,
      currency,
      receipt,
      status: "created",
    };
  }

  const order = await getRazorpayClient().orders.create({
    amount,
    currency,
    receipt,
  });
  return order;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function verifyHmac(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return timingSafeEqualHex(expected, signature);
}

export function verifyPayment(orderId: string, paymentId: string, signature: string): boolean {
  if (process.env.NODE_ENV === "production" && isMockBillingMode()) {
    return false;
  }
  if (isMockOrderId(orderId) || isMockPaymentId(paymentId)) {
    if (!isMockBillingMode()) return false;
    return verifyMockPaymentSignature(orderId, paymentId, signature);
  }

  const body = orderId + "|" + paymentId;
  return verifyHmac(body, signature, process.env.RAZORPAY_KEY_SECRET!);
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (process.env.NODE_ENV === "production") {
    if (isMockBillingMode()) return false;
  }
  if (isMockBillingMode()) {
    if (signature === "mock_webhook") return true;
    return false;
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    if (process.env.NODE_ENV === "production") return false;
    if (!process.env.RAZORPAY_KEY_SECRET?.trim()) return false;
    return verifyHmac(body, signature, process.env.RAZORPAY_KEY_SECRET);
  }
  return verifyHmac(body, signature, webhookSecret);
}

export function isRazorpaySubscriptionEnabled(): boolean {
  if (isMockBillingMode()) return true;
  return Boolean(
    process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID?.trim() ||
      process.env.RAZORPAY_PRO_YEARLY_PLAN_ID?.trim()
  );
}

export function getRazorpayPlanId(duration: "monthly" | "yearly"): string | null {
  if (isMockBillingMode()) {
    return duration === "yearly" ? "plan_mock_yearly" : "plan_mock_monthly";
  }

  const planId =
    duration === "yearly"
      ? process.env.RAZORPAY_PRO_YEARLY_PLAN_ID
      : process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID;
  return planId?.trim() || null;
}

export async function createRazorpaySubscription(params: {
  planId: string;
  totalCount: number;
  customerNotify?: 0 | 1;
  notes?: Record<string, string>;
}) {
  if (isMockBillingMode()) {
    return {
      id: createMockSubscriptionId(),
      plan_id: params.planId,
      status: "created",
    };
  }

  const subscription = await getRazorpayClient().subscriptions.create({
    plan_id: params.planId,
    total_count: params.totalCount,
    customer_notify: params.customerNotify ?? 1,
    notes: params.notes,
  });
  return subscription;
}

export async function cancelRazorpaySubscription(subscriptionId: string) {
  if (isMockSubscriptionId(subscriptionId)) {
    if (!isMockBillingMode()) {
      throw new Error("Invalid subscription");
    }
    return { id: subscriptionId, status: "cancelled" };
  }

  return getRazorpayClient().subscriptions.cancel(subscriptionId, false);
}

export async function fetchRazorpayPayment(paymentId: string) {
  if (isMockPaymentId(paymentId)) {
    if (!isMockBillingMode()) {
      throw new Error("Invalid payment");
    }
    return { id: paymentId, status: "captured" };
  }

  return getRazorpayClient().payments.fetch(paymentId);
}

export type RazorpaySubscriptionPaymentProof =
  | { ok: true; amountPaise?: number; paymentMethod?: string | null }
  | { ok: false; error: string; status: number };

/** Verify a Razorpay payment is captured and bound to the expected subscription. */
export async function verifyRazorpaySubscriptionPaymentBinding(
  paymentId: string,
  expectedSubscriptionId: string
): Promise<RazorpaySubscriptionPaymentProof> {
  if (isMockPaymentId(paymentId) || isMockSubscriptionId(expectedSubscriptionId)) {
    if (!isMockBillingMode()) {
      return { ok: false, error: "Payment verification failed", status: 400 };
    }
    return { ok: true, amountPaise: undefined, paymentMethod: null };
  }

  let rpPayment: Awaited<ReturnType<typeof fetchRazorpayPayment>>;
  try {
    rpPayment = await fetchRazorpayPayment(paymentId);
  } catch {
    return { ok: false, error: "Could not verify payment", status: 502 };
  }

  const status = (rpPayment as { status?: string }).status;
  if (status !== "captured") {
    return { ok: false, error: "Payment not captured", status: 400 };
  }

  const paymentSubscriptionId = (rpPayment as { subscription_id?: string | null })
    .subscription_id;
  if (!paymentSubscriptionId) {
    return {
      ok: false,
      error: "Payment is not linked to a subscription",
      status: 400,
    };
  }
  if (paymentSubscriptionId !== expectedSubscriptionId) {
    return {
      ok: false,
      error: "Payment does not belong to this subscription",
      status: 400,
    };
  }

  const rawAmount = (rpPayment as { amount?: number }).amount;
  const method = (rpPayment as { method?: string | null }).method ?? null;

  return {
    ok: true,
    amountPaise: rawAmount != null ? Math.round(Number(rawAmount)) : undefined,
    paymentMethod: method,
  };
}

export { createMockPaymentId };
