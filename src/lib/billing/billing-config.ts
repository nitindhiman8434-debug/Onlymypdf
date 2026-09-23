export type BillingMode = "live" | "mock" | "disabled";

/** Server-side billing mode. Set BILLING_MODE=mock for gateway-free dev/staging. */
export function getBillingMode(): BillingMode {
  const explicit = process.env.BILLING_MODE?.trim().toLowerCase();
  if (explicit === "mock") return "mock";
  if (explicit === "disabled") return "disabled";
  if (explicit === "live") return "live";

  const hasRazorpay = Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()
  );
  if (!hasRazorpay && process.env.NODE_ENV !== "production") {
    return "mock";
  }

  return "live";
}

export function isMockBillingMode(): boolean {
  return getBillingMode() === "mock";
}

export function isLiveRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() &&
      process.env.RAZORPAY_KEY_SECRET?.trim() &&
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim()
  );
}

export function isBillingCheckoutAvailable(): boolean {
  if (getBillingMode() === "disabled") return false;
  return isMockBillingMode() || isLiveRazorpayConfigured();
}

export function isSubscriptionBillingAvailable(): boolean {
  if (getBillingMode() === "disabled") return false;
  if (isMockBillingMode()) return true;
  return Boolean(
    process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID?.trim() ||
      process.env.RAZORPAY_PRO_YEARLY_PLAN_ID?.trim()
  );
}

export function getCheckoutUnavailableMessage(): string {
  if (getBillingMode() === "disabled") {
    return "Online payments are temporarily unavailable.";
  }
  if (isMockBillingMode()) {
    return "Mock billing is enabled but checkout failed. Please try again or contact support.";
  }
  return "Online payments are not configured yet. Set BILLING_MODE=mock for testing, or add Razorpay keys for live checkout.";
}
