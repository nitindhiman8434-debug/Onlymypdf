const RAZORPAY_SCRIPT = "https://checkout.razorpay.com";
const GOOGLE_APIS = "https://apis.google.com";
const DROPBOX = "https://www.dropbox.com";
const TURNSTILE = "https://challenges.cloudflare.com";

export function buildContentSecurityPolicy(nonce: string, isProd: boolean): string {
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' ${RAZORPAY_SCRIPT} ${GOOGLE_APIS} ${DROPBOX} ${TURNSTILE}`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' ${RAZORPAY_SCRIPT} ${GOOGLE_APIS} ${DROPBOX} ${TURNSTILE}`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    isProd
      ? "style-src 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'"
      : "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://checkout.razorpay.com https://lh3.googleusercontent.com https://www.gstatic.com",
    "connect-src 'self' blob: https://*.supabase.co https://*.supabase.in https://api.razorpay.com https://www.googleapis.com https://api.dropboxapi.com https://challenges.cloudflare.com",
    "frame-src 'self' blob: https://checkout.razorpay.com https://docs.google.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "report-uri /api/csp-report",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
