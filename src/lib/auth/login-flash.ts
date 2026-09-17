import { BLOCKED_LOGIN_MESSAGE } from "@/lib/auth/blocked-login-message";

const LOGIN_MESSAGES: Record<string, string> = {
  password_updated: "Password updated. Please log in with your new password.",
  signup_confirm: "Account created. Please check your email to confirm your account.",
  logged_out: "You have been signed out.",
};

const LOGIN_ERRORS: Record<string, string> = {
  oauth_failed: "Sign-in was cancelled or failed. Please try again.",
  account_blocked: BLOCKED_LOGIN_MESSAGE,
  session_expired: "Your session expired. Please sign in again.",
};

export function resolveLoginFlashMessage(code: string | null): string | null {
  if (!code) return null;
  return LOGIN_MESSAGES[code] ?? null;
}

export function resolveLoginFlashError(code: string | null): string | null {
  if (!code) return null;
  return LOGIN_ERRORS[code] ?? null;
}
