import {
  isBillingCheckoutAvailable,
  isSubscriptionBillingAvailable,
  getCheckoutUnavailableMessage,
  isMockBillingMode,
} from "@/lib/billing/billing-config";

export function isRazorpayCheckoutConfigured(): boolean {
  if (typeof window !== "undefined") {
    if (process.env.NEXT_PUBLIC_BILLING_MODE === "disabled") return false;
    return (
      process.env.NEXT_PUBLIC_BILLING_MODE === "mock" ||
      Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim())
    );
  }
  return isBillingCheckoutAvailable();
}

export function isRazorpaySubscriptionCheckoutConfigured(): boolean {
  if (typeof window !== "undefined") {
    if (process.env.NEXT_PUBLIC_BILLING_MODE === "disabled") return false;
    return (
      process.env.NEXT_PUBLIC_BILLING_MODE === "mock" ||
      (isRazorpayCheckoutConfigured() &&
        Boolean(
          process.env.NEXT_PUBLIC_RAZORPAY_PRO_MONTHLY_PLAN_ID?.trim() ||
            process.env.NEXT_PUBLIC_RAZORPAY_PRO_YEARLY_PLAN_ID?.trim()
        ))
    );
  }
  return isSubscriptionBillingAvailable() && isBillingCheckoutAvailable();
}

export function isMockCheckoutClient(): boolean {
  return process.env.NEXT_PUBLIC_BILLING_MODE === "mock";
}

export { getCheckoutUnavailableMessage, isMockBillingMode };
