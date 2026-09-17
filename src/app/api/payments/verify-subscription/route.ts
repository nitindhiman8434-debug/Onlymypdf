import { NextRequest, NextResponse } from "next/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { createServiceClient } from "@/lib/supabase/server";
import { fulfillSubscriptionCharge } from "@/lib/services/subscription-fulfillment.service";
import { cancelLocalSubscription } from "@/lib/services/subscription-fulfillment.service";
import { cancelRazorpaySubscription, verifyRazorpaySubscriptionPaymentBinding } from "@/lib/services/payment.service";
import { storedPaymentAmountToPaise } from "@/lib/payment/payment-amount";
import { toSafeApiError } from "@/lib/server/safe-error";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { checkAuthRateLimit, checkSubscriptionCancelRateLimit, rateLimitResponse } from "@/lib/server/rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await checkAuthRateLimit(request);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);

    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const body = await request.json();
    const { razorpay_subscription_id, razorpay_payment_id } = body as {
      razorpay_subscription_id?: string;
      razorpay_payment_id?: string;
    };

    if (!razorpay_subscription_id || !razorpay_payment_id) {
      return NextResponse.json({ error: "Missing subscription verification fields" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data: pending } = await supabase
      .from("payments")
      .select("user_id, amount")
      .eq("razorpay_subscription_id", razorpay_subscription_id)
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"])
      .maybeSingle();

    if (!pending) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("razorpay_subscription_id", razorpay_subscription_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!sub) {
        return NextResponse.json({ error: "Subscription not found for this account" }, { status: 403 });
      }
    }

    const proof = await verifyRazorpaySubscriptionPaymentBinding(
      razorpay_payment_id,
      razorpay_subscription_id
    );
    if (!proof.ok) {
      return NextResponse.json({ error: proof.error }, { status: proof.status });
    }
    const amountPaise = proof.amountPaise;

    if (pending?.amount != null && amountPaise != null) {
      const expectedPaise = storedPaymentAmountToPaise(Number(pending.amount));
      if (expectedPaise !== amountPaise) {
        return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 });
      }
    }

    const result = await fulfillSubscriptionCharge({
      razorpaySubscriptionId: razorpay_subscription_id,
      razorpayPaymentId: razorpay_payment_id,
      amountPaise,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, already_verified: result.already_verified });
  } catch (err) {
    return NextResponse.json(
      { error: toSafeApiError(err, "Subscription verification failed") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const cancelRate = await checkSubscriptionCancelRateLimit(request, user.id);
    if (!cancelRate.allowed) return rateLimitResponse(cancelRate.retryAfterSec);

    const supabase = await createServiceClient();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("razorpay_subscription_id")
      .eq("user_id", user.id)
      .in("status", ["active", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.razorpay_subscription_id) {
      return NextResponse.json({ error: "No active auto-renew subscription found." }, { status: 404 });
    }

    try {
      await cancelRazorpaySubscription(sub.razorpay_subscription_id);
    } catch {
      // still mark local cancel if Razorpay unreachable
    }

    await cancelLocalSubscription(sub.razorpay_subscription_id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: toSafeApiError(err, "Could not cancel subscription") }, { status: 500 });
  }
}
