import { createServiceClient } from "@/lib/supabase/server";
import { captureApiError } from "@/lib/server/safe-error";

/** Claim a Razorpay event id so at-least-once deliveries run the handler once. */
export async function claimWebhookEvent(
  eventId: string | null | undefined
): Promise<"new" | "duplicate"> {
  const id = eventId?.trim();
  if (!id) return "new";

  const supabase = await createServiceClient();
  const { error } = await supabase.from("webhook_events").insert({ event_id: id });

  if (!error) return "new";
  if (error.code === "23505") return "duplicate";
  throw error;
}

/** Drop a claim so Razorpay can retry after a 5xx / verify failure. */
export async function releaseWebhookEvent(eventId: string | null | undefined): Promise<void> {
  const id = eventId?.trim();
  if (!id) return;

  try {
    const supabase = await createServiceClient();
    await supabase.from("webhook_events").delete().eq("event_id", id);
  } catch (error) {
    captureApiError(error, { route: "webhook-claim-release", event_id: id });
  }
}

export type PaymentReconciliationInput = {
  razorpayOrderId?: string | null;
  razorpayPaymentId: string;
  amountPaise?: number | null;
  reason: string;
};

/**
 * Record a captured-but-unfulfilled payment for manual reconciliation.
 * Idempotent per razorpay_payment_id: repeated webhook retries bump `attempts`
 * instead of inserting duplicates. Never throws — reconciliation logging must
 * not mask the underlying fulfillment failure.
 */
export async function recordPaymentReconciliation(
  input: PaymentReconciliationInput
): Promise<void> {
  try {
    const supabase = await createServiceClient();

    const { data: existing } = await supabase
      .from("payment_reconciliation")
      .select("id, attempts")
      .eq("razorpay_payment_id", input.razorpayPaymentId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("payment_reconciliation")
        .update({
          attempts: (existing.attempts ?? 1) + 1,
          reason: input.reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      return;
    }

    await supabase.from("payment_reconciliation").insert({
      razorpay_order_id: input.razorpayOrderId ?? null,
      razorpay_payment_id: input.razorpayPaymentId,
      amount_paise: input.amountPaise ?? null,
      reason: input.reason,
      status: "unresolved",
      attempts: 1,
    });
  } catch (error) {
    captureApiError(error, {
      route: "payment-reconciliation",
      razorpay_payment_id: input.razorpayPaymentId,
    });
  }
}
