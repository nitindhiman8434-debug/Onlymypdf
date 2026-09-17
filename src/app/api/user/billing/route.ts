import { NextRequest, NextResponse } from "next/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { getUserProfile, getUserSubscription } from "@/lib/db/queries";
import { getBillingMode, isSubscriptionBillingAvailable } from "@/lib/billing/billing-config";
import { isActivePro } from "@/lib/auth/plan-access";
import { resolveProAccessForUser } from "@/lib/enterprise/org-access.service";
import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";

export async function GET(request: NextRequest) {
  const rateLimited = await guardGeneralApiRateLimit(request);
  if (rateLimited) return rateLimited;

  const auth = await tryGetApiUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const profile = await getUserProfile(user.id);
  const subscription = await getUserSubscription(user.id);

  let effectivePro = isActivePro(profile);
  try {
    const access = await resolveProAccessForUser(user.id);
    effectivePro = access.isPro;
  } catch {
    /* profile only */
  }

  const autoRenew = Boolean(
    subscription?.razorpay_subscription_id && !subscription?.cancelled_at
  );

  return NextResponse.json({
    plan: effectivePro ? "pro" : "free",
    planExpiresAt: profile?.plan_expires_at ?? null,
    billingMode: getBillingMode(),
    subscriptionAvailable: isSubscriptionBillingAvailable(),
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          razorpaySubscriptionId: subscription.razorpay_subscription_id,
          currentPeriodEnd: subscription.current_period_end,
          cancelledAt: subscription.cancelled_at,
          autoRenew,
          cancelAtPeriodEnd: Boolean(subscription.cancelled_at),
        }
      : null,
  });
}
