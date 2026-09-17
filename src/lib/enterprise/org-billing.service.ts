import { isMockBillingMode } from "@/lib/billing/billing-config";
import { createMockSubscriptionId } from "@/lib/billing/mock-billing.service";
import { createPayment, getPaymentByRazorpayPaymentId } from "@/lib/db/queries";
import { issueGstInvoiceForPayment } from "@/lib/billing/invoice.service";
import { TEAM_PRICING } from "@/config/constants";
import { EnterpriseSalesRequiredError } from "@/lib/enterprise/enterprise-sales";
import {
  activateOrganizationPlan,
  countOrganizationMembers,
  getOrganizationMemberRole,
} from "@/lib/enterprise/organizations.service";
import { logOrganizationAudit } from "@/lib/enterprise/org-audit";
import { createServiceClient } from "@/lib/supabase/server";

export type OrgBillingDuration = "monthly" | "yearly";

function addPeriod(from: Date, duration: OrgBillingDuration): Date {
  const end = new Date(from);
  if (duration === "yearly") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

function computeTeamAmountInr(seatCount: number, duration: OrgBillingDuration): number {
  const perSeat =
    duration === "yearly"
      ? TEAM_PRICING.yearlyInrPerSeat
      : TEAM_PRICING.monthlyInrPerSeat;
  return perSeat * Math.max(1, seatCount);
}

export async function activateOrganizationBilling(
  organizationId: string,
  ownerUserId: string,
  duration: OrgBillingDuration
): Promise<{ periodEnd: string; mock: boolean }> {
  const role = await getOrganizationMemberRole(organizationId, ownerUserId);
  if (role !== "owner") {
    throw new Error("Only the organization owner can activate team billing.");
  }

  const supabase = await createServiceClient();
  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name, seat_limit, plan_status")
    .eq("id", organizationId)
    .single();

  if (error || !org) throw new Error("Organization not found.");

  if (!isMockBillingMode()) {
    throw new EnterpriseSalesRequiredError(
      "Self-serve team billing is not live yet. Contact enterprise sales to activate your organization plan."
    );
  }

  const seatCount = await countOrganizationMembers(organizationId);
  const amountInr = computeTeamAmountInr(seatCount, duration);
  const periodEnd = addPeriod(new Date(), duration);
  const mockSubId = createMockSubscriptionId();

  await activateOrganizationPlan(organizationId, {
    razorpaySubscriptionId: mockSubId,
    periodEnd,
    dailyToolLimit: TEAM_PRICING.defaultDailyToolLimit,
  });

  const payment = await createPayment({
    user_id: ownerUserId,
    razorpay_subscription_id: mockSubId,
    amount: amountInr,
    currency: "INR",
    status: "completed",
    plan_name: "team",
    plan_duration: duration,
    billing_mode: "subscription",
  });

  await issueGstInvoiceForPayment({
    userId: ownerUserId,
    paymentId: payment.id,
    amountPaise: Math.round(amountInr * 100),
    razorpayPaymentId: `pay_mock_org_${organizationId.slice(0, 8)}`,
    planLabel: `Team ${duration} · ${org.name}`,
    organizationId,
  }).catch(() => {});

  await logOrganizationAudit({
    organizationId,
    actorUserId: ownerUserId,
    action: "billing.activate",
    payload: { duration, mock: true },
  });

  return { periodEnd: periodEnd.toISOString(), mock: true };
}

export async function cancelOrganizationAutoRenew(
  organizationId: string,
  actorUserId: string
): Promise<void> {
  const role = await getOrganizationMemberRole(organizationId, actorUserId);
  if (role !== "owner") {
    throw new Error("Only the organization owner can cancel team billing.");
  }

  const supabase = await createServiceClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("razorpay_subscription_id")
    .eq("id", organizationId)
    .maybeSingle();

  const razorpayId = org?.razorpay_subscription_id?.trim();
  if (razorpayId) {
    const { cancelRazorpaySubscription } = await import("@/lib/services/payment.service");
    try {
      await cancelRazorpaySubscription(razorpayId);
    } catch {
      // Clear the local link even if the gateway is unreachable; a stale
      // subscription is reconciled by webhook / support rather than left charging.
    }
  }

  await supabase
    .from("organizations")
    .update({
      razorpay_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  await logOrganizationAudit({
    organizationId,
    actorUserId: actorUserId,
    action: "billing.cancel_autorenew",
  });
}

export async function renewOrganizationPlanFromWebhook(input: {
  razorpaySubscriptionId: string;
  amountPaise?: number | null;
  paymentId?: string | null;
}): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, owner_id, name, seat_limit, plan_expires_at")
    .eq("razorpay_subscription_id", input.razorpaySubscriptionId)
    .maybeSingle();

  if (!org) return false;

  if (input.paymentId) {
    const alreadyPaid = await getPaymentByRazorpayPaymentId(input.paymentId);
    if (alreadyPaid) return true;
  }

  const { data: lastPayment } = await supabase
    .from("payments")
    .select("plan_duration")
    .eq("razorpay_subscription_id", input.razorpaySubscriptionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const duration: OrgBillingDuration =
    lastPayment?.plan_duration === "yearly" ? "yearly" : "monthly";

  // Flag (do not block) renewals whose charged amount no longer matches the
  // current seat count × price — surfaces seat drift / underpayment for ops.
  if (input.amountPaise != null) {
    const seatCount = await countOrganizationMembers(org.id);
    const expectedPaise = computeTeamAmountInr(seatCount, duration) * 100;
    if (Math.abs(expectedPaise - Math.round(input.amountPaise)) > 100) {
      const { captureApiError } = await import("@/lib/server/safe-error");
      captureApiError(
        new Error(
          `Org renewal amount mismatch: charged=${input.amountPaise}p expected=${expectedPaise}p org=${org.id} seats=${seatCount}`
        ),
        { route: "enterprise/org-renewal", organizationId: org.id }
      );
    }
  }

  const extendFrom =
    org.plan_expires_at && new Date(org.plan_expires_at) > new Date()
      ? new Date(org.plan_expires_at)
      : new Date();
  const periodEnd = addPeriod(extendFrom, duration);

  await activateOrganizationPlan(org.id, {
    razorpaySubscriptionId: input.razorpaySubscriptionId,
    periodEnd,
    dailyToolLimit: TEAM_PRICING.defaultDailyToolLimit,
  });

  if (input.paymentId && input.amountPaise) {
    const payment = await createPayment({
      user_id: org.owner_id,
      razorpay_payment_id: input.paymentId,
      razorpay_subscription_id: input.razorpaySubscriptionId,
      amount: input.amountPaise / 100,
      currency: "INR",
      status: "completed",
      plan_name: "team",
      plan_duration: duration,
      billing_mode: "subscription",
    });

    await issueGstInvoiceForPayment({
      userId: org.owner_id,
      paymentId: payment.id,
      amountPaise: input.amountPaise,
      razorpayPaymentId: input.paymentId,
      planLabel: `Team renewal · ${org.name}`,
      organizationId: org.id,
    }).catch(() => {});
  }

  await logOrganizationAudit({
    organizationId: org.id,
    action: "billing.renew",
    payload: { paymentId: input.paymentId ?? null },
  });

  return true;
}

export async function clearOrganizationAutoRenewByRazorpaySub(
  razorpaySubscriptionId: string
): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({
      razorpay_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("razorpay_subscription_id", razorpaySubscriptionId)
    .select("id");

  if (error) return false;
  return (data?.length ?? 0) > 0;
}
