const SAFE_MESSAGES = new Set([
  "Authentication required",
  "Access denied",
  "File not found",
  "Daily usage limit reached.",
  "Too many requests. Please try again later.",
  "Payment verification failed",
  "Invalid or expired coupon code",
  "Server is busy processing other files. Please try again in a moment.",
  "Heavy processing is temporarily unavailable. Please try again shortly.",
  "Your account has been suspended. Contact support for help.",
  "Enter your password to confirm account deletion.",
  "Incorrect password.",
]);

/** Return a client-safe error string — never leak paths, stack, or library internals. */
export function toSafeApiError(
  error: unknown,
  fallback = "An unexpected error occurred. Please try again."
): string {
  if (error instanceof Error) {
    const msg = error.message.trim();
    if (SAFE_MESSAGES.has(msg)) return msg;
    if (msg.length < 120 && !msg.includes("\\") && !msg.includes("/tmp")) {
      if (
        /^(Invalid|Missing|Failed to|Conversion|Password|Daily|Maximum|At least|File|PDF|Upload)/i.test(
          msg
        )
      ) {
        return msg;
      }
    }
  }
  return fallback;
}

/** Log unexpected API errors to Sentry in production. */
export function captureApiError(error: unknown, context?: Record<string, unknown>): void {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (process.env.NODE_ENV !== "production" || !dsn) return;
  void import("@/lib/ops/sentry").then(({ captureException }) =>
    captureException(error, context)
  );
}
