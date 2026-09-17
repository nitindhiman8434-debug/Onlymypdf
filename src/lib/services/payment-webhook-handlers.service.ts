import {
  getPaymentByRazorpayOrderId,
  getPaymentByRazorpayPaymentId,
  updatePayment,
  updateSubscription,
  updateUserProfile,
} from "@/lib/db/queries";
import { createServiceClient } from "@/lib/supabase/server";
import { getPrimaryOrganizationForUser } from "@/lib/enterprise/org-access.service";

type RazorpayPaymentEntity = {
  id?: string;
  order_id?: string;
};

type PaymentRow = NonNullable<Awaited<ReturnType<typeof getPaymentByRazorpayPaymentId>>>;

async function revokeEntitlementsForRefundedPayment(payment: PaymentRow): Promise<void> {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  const { data: invoice } = await supabase
    .from("billing_invoices")
    .select("organization_id")
    .eq("payment_id", payment.id)
    .maybeSingle();

  const isTeamPayment = payment.plan_name === "team";

  if (invoice?.organization_id || isTeamPayment) {
    const orgQuery = invoice?.organization_id
      ? supabase
          .from("organizations")
          .update({
            plan_status: "cancelled",
            razorpay_subscription_id: null,
            plan_expires_at: now,
            updated_at: now,
          })
          .eq("id", invoice.organization_id)
      : payment.razorpay_subscription_id
        ? supabase
            .from("organizations")
            .update({
              plan_status: "cancelled",
              razorpay_subscription_id: null,
              plan_expires_at: now,
              updated_at: now,
            })
            .eq("razorpay_subscription_id", payment.razorpay_subscription_id)
        : null;

    if (orgQuery) await orgQuery;
    return;
  }

  if (payment.subscription_id) {
    await updateSubscription(payment.subscription_id, { status: "cancelled" });
  }

  // Only downgrade the individual plan if no OTHER active entitlement remains
  // (another live subscription or an active organization membership). Prevents a
  // single one-time refund from wiping Pro that the user still legitimately holds.
  const stillEntitled = await userHasOtherActiveEntitlement(
    supabase,
    payment.user_id,
    payment.subscription_id ?? null
  );
  if (!stillEntitled) {
    await updateUserProfile(payment.user_id, {
      plan: "free",
      plan_expires_at: null,
    });
  }
}

async function userHasOtherActiveEntitlement(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
  excludeSubscriptionId: string | null
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .is("cancelled_at", null)
    .gt("current_period_end", now);

  const hasOtherSub = (subs ?? []).some((s) => s.id !== excludeSubscriptionId);
  if (hasOtherSub) return true;

  const org = await getPrimaryOrganizationForUser(userId);
  return Boolean(org);
}

/** Mark a pending/processing checkout payment as failed (one-time orders). */
export async function handlePaymentFailedWebhook(
  entity: RazorpayPaymentEntity
): Promise<boolean> {
  const payment =
    (entity.order_id ? await getPaymentByRazorpayOrderId(entity.order_id) : null) ??
    (entity.id ? await getPaymentByRazorpayPaymentId(entity.id) : null);

  if (!payment) return false;
  if (payment.status !== "pending" && payment.status !== "processing") return false;

  await updatePayment(payment.id, {
    status: "failed",
    ...(entity.id && !payment.razorpay_payment_id
      ? { razorpay_payment_id: entity.id }
      : {}),
  });
  return true;
}

/** Mark a captured payment as refunded and revoke granted entitlements. */
export async function handlePaymentRefundedWebhook(
  razorpayPaymentId: string
): Promise<boolean> {
  const payment = await getPaymentByRazorpayPaymentId(razorpayPaymentId);
  if (!payment) return false;
  if (payment.status !== "completed") return false;

  await updatePayment(payment.id, { status: "refunded" });
  await revokeEntitlementsForRefundedPayment(payment);
  return true;
}

/** Subscription payment failures — mark local subscription/org as past_due. */
export async function handleSubscriptionHaltedWebhook(
  razorpaySubscriptionId: string
): Promise<boolean> {
  const supabase = await createServiceClient();
  let handled = false;
  const now = new Date().toISOString();

  const { data: subs } = await supabase
    .from("subscriptions")
    .update({ status: "past_due", updated_at: now })
    .eq("razorpay_subscription_id", razorpaySubscriptionId)
    .in("status", ["active", "past_due"])
    .select("id");

  if (subs && subs.length > 0) handled = true;

  const { data: orgs } = await supabase
    .from("organizations")
    .update({ plan_status: "past_due", updated_at: now })
    .eq("razorpay_subscription_id", razorpaySubscriptionId)
    .in("plan_status", ["active", "past_due"])
    .select("id");

  if (orgs && orgs.length > 0) handled = true;

  return handled;
}
