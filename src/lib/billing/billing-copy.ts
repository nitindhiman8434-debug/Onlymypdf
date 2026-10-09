import {
  FILE_LIMITS,
  SUPPORT_EMAIL,
  formatFileSizeMarketingLabel,
} from "@/config/constants";

/** Shared FAQ line for tool pages and /faq — matches upload enforcement. */
export function planFileSizeFaqLine(): string {
  const free = formatFileSizeMarketingLabel(FILE_LIMITS.maxFreeFileSizeMB).toLowerCase();
  const pro = formatFileSizeMarketingLabel(FILE_LIMITS.maxProFileSizeMB).toLowerCase();
  return `Free: ${free}; Pro: ${pro}. Tool-specific limits also apply.`;
}

export function fileSizeLimitShortAnswer(): string {
  return `Free users: ${formatFileSizeMarketingLabel(FILE_LIMITS.maxFreeFileSizeMB).toLowerCase()}. Pro users: ${formatFileSizeMarketingLabel(FILE_LIMITS.maxProFileSizeMB).toLowerCase()}. Tool-specific limits also apply.`;
}

/** Tool dropzones — matches server enforcement (free vs Pro). */
export function toolPageUploadSubHint(): string {
  const free = formatFileSizeMarketingLabel(FILE_LIMITS.maxFreeFileSizeMB).toLowerCase();
  const pro = formatFileSizeMarketingLabel(FILE_LIMITS.maxProFileSizeMB).toLowerCase();
  return `Free ${free} · Pro ${pro} · PDF only · Tool-specific limits apply`;
}

export const TOOL_UPLOAD_SUB_HINT = toolPageUploadSubHint();

/** Single-line upload helper for generic file pickers. */
export function uploadDropzoneSizeLabel(maxSizeMB: number): string {
  if (maxSizeMB <= 0) {
    return fileSizeLimitShortAnswer();
  }
  return `Max file size: ${maxSizeMB} MB · Tool-specific limits apply`;
}

export function compressToolAeoSizeFact(): string {
  return `Upload limits: free ${formatFileSizeMarketingLabel(FILE_LIMITS.maxFreeFileSizeMB).toLowerCase()}, Pro ${formatFileSizeMarketingLabel(FILE_LIMITS.maxProFileSizeMB).toLowerCase()}; tool-specific limits apply`;
}

export const BILLING_COPY = {
  refundSummary: `Contact ${SUPPORT_EMAIL} for refund requests. Include your Razorpay payment ID and registered email. Eligibility is reviewed per our refund policy.`,
  cancelAutoRenew:
    "Cancel auto-renew anytime from Dashboard → Billing. Pro access continues until the end of your current billing period.",
  paymentMethods:
    "When live checkout is enabled, Razorpay shows the available payment methods, which may include UPI, cards, net banking, and wallets. Prices are in INR; invoices appear in Dashboard → Billing after a successful payment.",
  checkoutModel:
    "Before payment, checkout states whether the purchase renews automatically or is a one-time purchase. Live payments are processed by Razorpay when checkout is available.",
  mockCheckoutNote:
    "Mock billing mode: checkout completes without real charges — for staging and development only.",
  billingCycleChange:
    "Choose monthly or yearly at checkout. To change cycle later, cancel auto-renew and purchase the plan you want, or contact support.",
  proIncludes: (() => {
    const proSize = formatFileSizeMarketingLabel(FILE_LIMITS.maxProFileSizeMB).toLowerCase();
    return `100 tool uses per day, ${proSize}, Sign PDF, AI Summarizer, and no ads. Tool-specific limits apply. Stored account files are assigned a 24-hour expiry; processing and preview links may expire sooner. Download promptly. Cleanup may be delayed by retries.`;
  })(),
} as const;
