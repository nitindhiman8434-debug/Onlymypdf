import {
  FILE_LIMITS,
  SUPPORT_EMAIL,
  formatFileSizeMarketingLabel,
} from "@/config/constants";

/** Shared FAQ line for tool pages and /faq — matches upload enforcement. */
export function planFileSizeFaqLine(): string {
  const free = formatFileSizeMarketingLabel(FILE_LIMITS.maxFreeFileSizeMB).toLowerCase();
  const pro = formatFileSizeMarketingLabel(FILE_LIMITS.maxProFileSizeMB).toLowerCase();
  return `Free: ${free}; Pro: ${pro}.`;
}

export function fileSizeLimitShortAnswer(): string {
  return `Free users: ${formatFileSizeMarketingLabel(FILE_LIMITS.maxFreeFileSizeMB).toLowerCase()}. Pro users: ${formatFileSizeMarketingLabel(FILE_LIMITS.maxProFileSizeMB).toLowerCase()}.`;
}

/** Tool dropzones — matches server enforcement (free vs Pro). */
export function toolPageUploadSubHint(): string {
  const free = formatFileSizeMarketingLabel(FILE_LIMITS.maxFreeFileSizeMB).toLowerCase();
  const pro = formatFileSizeMarketingLabel(FILE_LIMITS.maxProFileSizeMB).toLowerCase();
  return `Free ${free} · Pro ${pro} · PDF only`;
}

export const TOOL_UPLOAD_SUB_HINT = toolPageUploadSubHint();

/** Single-line upload helper for generic file pickers. */
export function uploadDropzoneSizeLabel(maxSizeMB: number): string {
  if (maxSizeMB <= 0) {
    return fileSizeLimitShortAnswer();
  }
  return `Max file size: ${maxSizeMB} MB`;
}

export function compressToolAeoSizeFact(): string {
  return `Upload limits: free ${formatFileSizeMarketingLabel(FILE_LIMITS.maxFreeFileSizeMB).toLowerCase()}, Pro ${formatFileSizeMarketingLabel(FILE_LIMITS.maxProFileSizeMB).toLowerCase()}`;
}

export const BILLING_COPY = {
  refundSummary: `Contact ${SUPPORT_EMAIL} for refund requests. Include your Razorpay payment ID and registered email. Eligibility is reviewed per our refund policy.`,
  cancelAutoRenew:
    "Cancel auto-renew anytime from Dashboard → Billing. Pro access continues until the end of your current billing period.",
  paymentMethods:
    "UPI, credit/debit cards, net banking, and wallets through Razorpay. Prices are in INR; GST tax invoices download from Dashboard → Billing after payment.",
  checkoutModel:
    "Before payment, checkout states whether the purchase renews automatically or is a one-time purchase. Live payments are processed by Razorpay when checkout is available.",
  mockCheckoutNote:
    "Mock billing mode: checkout completes without real charges — for staging and development only.",
  billingCycleChange:
    "Choose monthly or yearly at checkout. To change cycle later, cancel auto-renew and purchase the plan you want, or contact support.",
  proIncludes: (() => {
    const proSize = formatFileSizeMarketingLabel(FILE_LIMITS.maxProFileSizeMB).toLowerCase();
    return `100 tool uses per day, ${proSize}, Sign PDF, AI Summarizer, priority processing, 24-hour file retention, and GST invoices.`;
  })(),
} as const;
