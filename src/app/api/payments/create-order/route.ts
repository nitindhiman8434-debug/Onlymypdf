import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedSupabaseUser } from "@/lib/auth/get-api-user";
import { authGuardResponse } from "@/lib/server/auth-guard-http";
import { createOrder } from "@/lib/services/payment.service";
import {
  getCheckoutUnavailableMessage,
  isBillingCheckoutAvailable,
  isMockBillingMode,
} from "@/lib/billing/billing-config";
import { createPayment, getCouponCode } from "@/lib/db/queries";
import { checkAuthRateLimit, checkCouponAttemptRateLimit, rateLimitResponse } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { toSafeApiError } from "@/lib/server/safe-error";

import { PRO_PRICING } from "@/config/constants";

const PLAN_PRICES = {
  pro: {
    monthly: PRO_PRICING.monthlyPaise,
    yearly: PRO_PRICING.yearlyPaise,
  },
} as const;

export async function POST(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await checkAuthRateLimit(request);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSec);

    if (!isBillingCheckoutAvailable()) {
      return NextResponse.json(
        { error: getCheckoutUnavailableMessage() },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const user = await getAuthenticatedSupabaseUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { plan, duration, couponCode } = await request.json();

    if (!plan || !duration) {
      return NextResponse.json({ error: "Plan and duration are required" }, { status: 400 });
    }

    if (plan !== "pro") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (duration !== "monthly" && duration !== "yearly") {
      return NextResponse.json({ error: "Duration must be 'monthly' or 'yearly'" }, { status: 400 });
    }

    let amount = PLAN_PRICES.pro[duration as "monthly" | "yearly"];
    let discountApplied = 0;
    let normalizedCoupon: string | null = null;

    if (couponCode) {
      const couponRate = await checkCouponAttemptRateLimit(request, user.id);
      if (!couponRate.allowed) return rateLimitResponse(couponRate.retryAfterSec);

      const coupon = await getCouponCode(couponCode);
      if (!coupon) {
        return NextResponse.json(
          {
            error:
              "Could not apply the provided code. Check the code and try again.",
          },
          { status: 400 }
        );
      }

      normalizedCoupon = coupon.code;
      discountApplied = Math.round(amount * (coupon.discount_percent / 100));
      amount = amount - discountApplied;
    }

    const MIN_ORDER_PAISE = 100;
    if (amount < MIN_ORDER_PAISE) {
      return NextResponse.json(
        { error: "Order amount is below the minimum chargeable amount." },
        { status: 400 }
      );
    }

    const receipt = `order_${user.id}_${Date.now()}`;
    const order = await createOrder(amount, "INR", receipt);

    await createPayment({
      user_id: user.id,
      razorpay_order_id: order.id,
      amount: amount / 100,
      currency: "INR",
      status: "pending",
      plan_name: plan,
      plan_duration: duration,
      coupon_code: normalizedCoupon,
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      plan,
      duration,
      discount_applied: discountApplied,
      mock: isMockBillingMode(),
      billing_mode: isMockBillingMode() ? "mock" : "live",
    });
  } catch (err) {
    const guarded = authGuardResponse(err);
    if (guarded) return guarded;
    return NextResponse.json(
      { error: toSafeApiError(err, "Failed to create order") },
      { status: 500 }
    );
  }
}
