import { NextRequest, NextResponse } from "next/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { isMockBillingMode } from "@/lib/billing/billing-config";
import {
  createMockPaymentId,
  createMockPaymentSignature,
  isMockOrderId,
  isMockSubscriptionId,
} from "@/lib/billing/mock-billing.service";
import { fulfillPendingPayment } from "@/lib/services/payment-fulfillment.service";
import { fulfillSubscriptionCharge } from "@/lib/services/subscription-fulfillment.service";
import { getPaymentByRazorpayOrderId } from "@/lib/db/queries";
import { createServiceClient } from "@/lib/supabase/server";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { checkAuthRateLimit, rateLimitResponse } from "@/lib/server/rate-limiter";
import { toSafeApiError } from "@/lib/server/safe-error";
import { PRO_PRICING } from "@/config/constants";
import { storedPaymentAmountToPaise } from "@/lib/payment/payment-amount";

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production" || !isMockBillingMode()) {
      return NextResponse.json({ error: "Mock billing is not enabled" }, { status: 403 });
    }

    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await checkAuthRateLimit(request);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);

    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const body = await request.json();
    const { type, razorpay_order_id, razorpay_subscription_id, duration } = body as {
      type?: "order" | "subscription";
      razorpay_order_id?: string;
      razorpay_subscription_id?: string;
      duration?: "monthly" | "yearly";
    };

    if (type === "subscription") {
      if (!razorpay_subscription_id || !isMockSubscriptionId(razorpay_subscription_id)) {
        return NextResponse.json({ error: "Invalid mock subscription" }, { status: 400 });
      }

      const supabase = await createServiceClient();
      const { data: owned } = await supabase
        .from("payments")
        .select("id")
        .eq("razorpay_subscription_id", razorpay_subscription_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!owned) {
        return NextResponse.json({ error: "Subscription not found for this account" }, { status: 403 });
      }

      const paymentId = createMockPaymentId();
      const amountPaise =
        duration === "yearly" ? PRO_PRICING.yearlyPaise : PRO_PRICING.monthlyPaise;

      const result = await fulfillSubscriptionCharge({
        razorpaySubscriptionId: razorpay_subscription_id,
        razorpayPaymentId: paymentId,
        amountPaise,
        paymentMethod: "mock",
      });

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      return NextResponse.json({
        success: true,
        mock: true,
        razorpay_payment_id: paymentId,
        already_verified: result.already_verified,
      });
    }

    if (!razorpay_order_id || !isMockOrderId(razorpay_order_id)) {
      return NextResponse.json({ error: "Invalid mock order" }, { status: 400 });
    }

    const pending = await getPaymentByRazorpayOrderId(razorpay_order_id);
    if (!pending || pending.user_id !== user.id) {
      return NextResponse.json({ error: "Order not found for this account" }, { status: 403 });
    }

    const paymentId = createMockPaymentId();
    const signature = createMockPaymentSignature(razorpay_order_id, paymentId);
    const amountPaise = storedPaymentAmountToPaise(Number(pending.amount));

    const result = await fulfillPendingPayment({
      razorpay_order_id,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      amount: amountPaise,
      payment_method: "mock",
      requireSignature: true,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      mock: true,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      already_verified: result.already_verified,
    });
  } catch (err) {
    return NextResponse.json(
      { error: toSafeApiError(err, "Mock checkout failed") },
      { status: 500 }
    );
  }
}
