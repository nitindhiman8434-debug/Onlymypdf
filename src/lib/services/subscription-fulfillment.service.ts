import {
  claimPaymentForFulfillment,
  createPayment,
  createSubscription,
  finalizeClaimedPayment,
  getPaymentByRazorpayPaymentId,
  getPlanUuidByName,
  getUserProfile,
  getUserSubscription,
  updateSubscription,
  updateUserProfile,
} from "@/lib/db/queries";
import { createServiceClient } from "@/lib/supabase/server";
import { isActivePro } from "@/lib/auth/plan-access";
import type { FulfillPaymentResult } from "@/lib/services/payment-fulfillment.service";
import { issueGstInvoiceForPayment } from "@/lib/billing/invoice.service";
import { storedPaymentAmountToPaise } from "@/lib/payment/payment-amount";
import { releasePaymentClaim } from "@/lib/db/queries";
import { verifyRazorpaySubscriptionPaymentBinding } from "@/lib/services/payment.service";

function addPeriod(from: Date, duration: "monthly" | "yearly"): Date {
  const end = new Date(from);
  if (duration === "yearly") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

export async function fulfillSubscriptionCharge(input: {
  razorpaySubscriptionId: string;
  razorpayPaymentId: string;
  amountPaise?: number | null;
  paymentMethod?: string | null;
}): Promise<FulfillPaymentResult> {
  const existingByPayment = await getPaymentByRazorpayPaymentId(input.razorpayPaymentId);
  if (existingByPayment?.status === "completed") {
    if (
      !existingByPayment.razorpay_subscription_id ||
      existingByPayment.razorpay_subscription_id === input.razorpaySubscriptionId
    ) {
      return { ok: true, already_verified: true };
    }
    return { ok: false, status: 409, error: "Payment already used" };
  }

  // If the user already cancelled auto-renew, an in-flight charge webhook must
  // NOT reactivate/extend the plan. Acknowledge (200) so Razorpay stops retrying.
  const cancelCheckClient = await createServiceClient();
  const { data: cancelledSub } = await cancelCheckClient
    .from("subscriptions")
    .select("id")
    .eq("razorpay_subscription_id", input.razorpaySubscriptionId)
    .not("cancelled_at", "is", null)
    .maybeSingle();
  if (cancelledSub) {
    return { ok: true, already_verified: true };
  }

  const proof = await verifyRazorpaySubscriptionPaymentBinding(
    input.razorpayPaymentId,
    input.razorpaySubscriptionId
  );
  if (!proof.ok) {
    return { ok: false, status: proof.status, error: proof.error };
  }

  const amountPaise = input.amountPaise ?? proof.amountPaise ?? null;
  const paymentMethod = input.paymentMethod ?? proof.paymentMethod ?? null;

  const supabase = await createServiceClient();

  const { data: paymentRow } = await supabase
    .from("payments")
    .select("*")
    .eq("razorpay_subscription_id", input.razorpaySubscriptionId)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!paymentRow) {
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("user_id, id")
      .eq("razorpay_subscription_id", input.razorpaySubscriptionId)
      .maybeSingle();

    if (!subRow) {
      return { ok: false, status: 400, error: "Unknown subscription" };
    }

    const duration =
      (await supabase
        .from("payments")
        .select("plan_duration")
        .eq("user_id", subRow.user_id)
        .eq("razorpay_subscription_id", input.razorpaySubscriptionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()).data?.plan_duration === "yearly"
        ? "yearly"
        : "monthly";

    return extendActiveSubscription({
      userId: subRow.user_id,
      subscriptionRowId: subRow.id,
      razorpaySubscriptionId: input.razorpaySubscriptionId,
      razorpayPaymentId: input.razorpayPaymentId,
      duration,
      amountPaise,
      paymentMethod,
    });
  }

  const claimed = await claimPaymentForFulfillment(paymentRow.id);
  if (!claimed) {
    if (paymentRow.status === "completed") {
      return { ok: true, already_verified: true };
    }
    return { ok: false, status: 409, error: "Payment verification failed" };
  }

  if (amountPaise != null && claimed.amount != null) {
    const expectedPaise = storedPaymentAmountToPaise(Number(claimed.amount));
    if (expectedPaise !== Math.round(amountPaise)) {
      await releasePaymentClaim(claimed.id);
      return { ok: false, status: 400, error: "Payment amount mismatch" };
    }
  }

  const duration = claimed.plan_duration === "yearly" ? "yearly" : "monthly";
  const periodEnd = addPeriod(new Date(), duration);
  const planUuid = await getPlanUuidByName(claimed.plan_name || "pro");

  const existingSub = await getUserSubscription(claimed.user_id);
  const subscription = existingSub
    ? await updateSubscription(existingSub.id, {
        status: "active",
        razorpay_subscription_id: input.razorpaySubscriptionId,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
    : await createSubscription({
        user_id: claimed.user_id,
        plan_id: planUuid,
        status: "active",
        razorpay_subscription_id: input.razorpaySubscriptionId,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
      });

  const payment = await finalizeClaimedPayment(claimed.id, {
    razorpay_payment_id: input.razorpayPaymentId,
    subscription_id: subscription.id,
    ...(amountPaise != null ? { amount: amountPaise / 100 } : {}),
    ...(paymentMethod ? { payment_method: paymentMethod } : {}),
  });

  if (!payment) {
    const profile = await getUserProfile(claimed.user_id);
    if (isActivePro(profile)) {
      return { ok: true, already_verified: true };
    }
    return { ok: false, status: 409, error: "Payment verification failed" };
  }

  await updateUserProfile(claimed.user_id, {
    plan: "pro",
    plan_expires_at: periodEnd.toISOString(),
  });

  await issueGstInvoiceForPayment({
    userId: claimed.user_id,
    paymentId: payment.id,
    amountPaise: amountPaise ?? Math.round(Number(claimed.amount) * 100),
    razorpayPaymentId: input.razorpayPaymentId,
    planLabel: `Pro ${duration}`,
  }).catch(() => {});

  return {
    ok: true,
    already_verified: false,
    payment_id: payment.id,
    subscription_id: subscription.id,
  };
}

async function extendActiveSubscription(input: {
  userId: string;
  subscriptionRowId: string;
  razorpaySubscriptionId: string;
  razorpayPaymentId: string;
  duration: "monthly" | "yearly";
  amountPaise?: number | null;
  paymentMethod?: string | null;
}): Promise<FulfillPaymentResult> {
  const existingSub = await getUserSubscription(input.userId);
  const extendFrom =
    existingSub?.current_period_end && new Date(existingSub.current_period_end) > new Date()
      ? new Date(existingSub.current_period_end)
      : new Date();
  const periodEnd = addPeriod(extendFrom, input.duration);

  await updateSubscription(input.subscriptionRowId, {
    status: "active",
    current_period_start: new Date().toISOString(),
    current_period_end: periodEnd.toISOString(),
  });

  await updateUserProfile(input.userId, {
    plan: "pro",
    plan_expires_at: periodEnd.toISOString(),
  });

  const planUuid = await getPlanUuidByName("pro");
  const payment = await createPayment({
    user_id: input.userId,
    razorpay_payment_id: input.razorpayPaymentId,
    razorpay_subscription_id: input.razorpaySubscriptionId,
    amount: input.amountPaise != null ? input.amountPaise / 100 : 0,
    currency: "INR",
    status: "completed",
    plan_name: "pro",
    plan_duration: input.duration,
    billing_mode: "subscription",
    subscription_id: input.subscriptionRowId,
    plan_id: planUuid,
  } as Parameters<typeof createPayment>[0]);

  await issueGstInvoiceForPayment({
    userId: input.userId,
    paymentId: payment.id,
    amountPaise: input.amountPaise ?? 0,
    razorpayPaymentId: input.razorpayPaymentId,
    planLabel: `Pro ${input.duration} renewal`,
  }).catch(() => {});

  return {
    ok: true,
    already_verified: false,
    payment_id: payment.id,
    subscription_id: input.subscriptionRowId,
  };
}

export async function cancelLocalSubscription(razorpaySubscriptionId: string): Promise<void> {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  await supabase
    .from("subscriptions")
    .update({
      cancelled_at: now,
      updated_at: now,
    })
    .eq("razorpay_subscription_id", razorpaySubscriptionId);
}
