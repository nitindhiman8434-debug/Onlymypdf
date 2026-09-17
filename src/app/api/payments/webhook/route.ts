import { NextRequest, NextResponse } from "next/server";

import {
  fetchRazorpayPayment,
  verifyRazorpaySubscriptionPaymentBinding,
  verifyWebhookSignature,
} from "@/lib/services/payment.service";
import { fulfillPendingPayment } from "@/lib/services/payment-fulfillment.service";
import {
  claimWebhookEvent,
  recordPaymentReconciliation,
  releaseWebhookEvent,
} from "@/lib/services/payment-reconciliation.service";
import {
  handlePaymentFailedWebhook,
  handlePaymentRefundedWebhook,
  handleSubscriptionHaltedWebhook,
} from "@/lib/services/payment-webhook-handlers.service";
import {
  fulfillSubscriptionCharge,
  cancelLocalSubscription,
} from "@/lib/services/subscription-fulfillment.service";
import {
  renewOrganizationPlanFromWebhook,
  clearOrganizationAutoRenewByRazorpaySub,
} from "@/lib/enterprise/org-billing.service";
import { guardWebhookRateLimit } from "@/lib/server/rate-limiter";
import { captureApiError } from "@/lib/server/safe-error";

function webhookEventId(request: NextRequest, event: { id?: unknown }): string | null {
  return (
    request.headers.get("x-razorpay-event-id")?.trim() ||
    (typeof event.id === "string" ? event.id : null)
  );
}

async function retryableFailure(
  eventId: string | null,
  body: Record<string, unknown>,
  status: number
): Promise<NextResponse> {
  await releaseWebhookEvent(eventId);
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const rateLimited = await guardWebhookRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const isValid = verifyWebhookSignature(body, signature);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);
    const eventType = event.event;
    const payload = event.payload ?? {};
    const eventId = webhookEventId(request, event);

    if ((await claimWebhookEvent(eventId)) === "duplicate") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    try {
      switch (eventType) {
      case "payment.captured": {
        const paymentEntity = payload.payment?.entity;
        if (!paymentEntity?.id) break;

        let livePayment: Awaited<ReturnType<typeof fetchRazorpayPayment>>;
        try {
          livePayment = await fetchRazorpayPayment(paymentEntity.id);
        } catch {
          return retryableFailure(
            eventId,
            { error: "Could not verify captured payment" },
            502
          );
        }

        const status = (livePayment as { status?: string }).status;
        if (status && status !== "captured") {
          return retryableFailure(
            eventId,
            { error: "Payment not captured" },
            400
          );
        }

        const orderId =
          (livePayment as { order_id?: string | null }).order_id ??
          paymentEntity.order_id;
        if (!orderId) break;

        const amount =
          (livePayment as { amount?: number }).amount ?? paymentEntity.amount;
        const method =
          (livePayment as { method?: string | null }).method ??
          paymentEntity.method ??
          null;

        const result = await fulfillPendingPayment({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentEntity.id,
          payment_method: method,
          amount,
          requireSignature: false,
        });

        if (!result.ok) {
          console.error("Webhook payment fulfillment failed:", result.error);
          captureApiError(new Error(result.error), {
            route: "payments/webhook",
            razorpay_order_id: orderId,
            status: result.status,
          });
          await recordPaymentReconciliation({
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentEntity.id,
            amountPaise: amount != null ? Math.round(Number(amount)) : null,
            reason: `captured_unfulfilled:${result.status}:${result.error}`,
          });
          return retryableFailure(
            eventId,
            { error: "Fulfillment failed; will retry", reason: result.error },
            result.status >= 500 ? result.status : 500
          );
        }
        break;
      }

      case "payment.failed": {
        const paymentEntity = payload.payment?.entity;
        if (paymentEntity) {
          await handlePaymentFailedWebhook(paymentEntity);
        }
        break;
      }

      case "refund.processed":
      case "refund.created": {
        const refundEntity = payload.refund?.entity;
        const paymentId = refundEntity?.payment_id;
        if (paymentId) {
          await handlePaymentRefundedWebhook(paymentId);
        }
        break;
      }

      case "subscription.charged": {
        const paymentEntity = payload.payment?.entity;
        const subscriptionEntity = payload.subscription?.entity;
        if (!paymentEntity?.id) break;

        const subId = subscriptionEntity?.id ?? paymentEntity.subscription_id;
        if (!subId) break;

        const proof = await verifyRazorpaySubscriptionPaymentBinding(
          paymentEntity.id,
          subId
        );
        if (!proof.ok) {
          return retryableFailure(
            eventId,
            { error: proof.error },
            proof.status >= 500 ? proof.status : 400
          );
        }

        const amountPaise = proof.amountPaise ?? paymentEntity.amount;
        const paymentMethod = proof.paymentMethod ?? paymentEntity.method ?? null;

        const orgRenewed = await renewOrganizationPlanFromWebhook({
          razorpaySubscriptionId: subId,
          amountPaise,
          paymentId: paymentEntity.id,
        });

        if (orgRenewed) break;

        const result = await fulfillSubscriptionCharge({
          razorpaySubscriptionId: subId,
          razorpayPaymentId: paymentEntity.id,
          amountPaise,
          paymentMethod,
        });

        if (!result.ok && result.status >= 500) {
          return retryableFailure(eventId, { error: result.error }, 500);
        }
        break;
      }

      case "subscription.halted": {
        const subscriptionEntity = payload.subscription?.entity;
        if (subscriptionEntity?.id) {
          await handleSubscriptionHaltedWebhook(subscriptionEntity.id);
        }
        break;
      }

      case "subscription.cancelled":
      case "subscription.completed": {
        const subscriptionEntity = payload.subscription?.entity;
        if (!subscriptionEntity?.id) break;

        const orgHandled = await clearOrganizationAutoRenewByRazorpaySub(
          subscriptionEntity.id
        );
        if (!orgHandled) {
          await cancelLocalSubscription(subscriptionEntity.id);
        }
        break;
      }

      case "subscription.updated": {
        const subscriptionEntity = payload.subscription?.entity;
        const paymentEntity = payload.payment?.entity;

        if (
          subscriptionEntity?.status === "halted" ||
          subscriptionEntity?.status === "past_due"
        ) {
          if (subscriptionEntity.id) {
            await handleSubscriptionHaltedWebhook(subscriptionEntity.id);
          }
          break;
        }

        if (
          subscriptionEntity?.status === "active" &&
          paymentEntity?.id &&
          paymentEntity?.subscription_id
        ) {
          const proof = await verifyRazorpaySubscriptionPaymentBinding(
            paymentEntity.id,
            paymentEntity.subscription_id
          );
          if (proof.ok) {
            await fulfillSubscriptionCharge({
              razorpaySubscriptionId: paymentEntity.subscription_id,
              razorpayPaymentId: paymentEntity.id,
              amountPaise: proof.amountPaise ?? paymentEntity.amount,
              paymentMethod: proof.paymentMethod ?? paymentEntity.method ?? null,
            });
          }
        }
        break;
      }

      default:
        break;
    }

      return NextResponse.json({ received: true });
    } catch (handlerErr) {
      await releaseWebhookEvent(eventId);
      throw handlerErr;
    }
  } catch (err) {
    captureApiError(err, { route: "payments/webhook" });
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
