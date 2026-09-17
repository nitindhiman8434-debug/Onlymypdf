import { isLocalDevAuthEnabled } from "@/lib/auth/auth-config";

/** True when CSRF / mutation-origin checks must run (fail closed on real deployments). */
export function shouldEnforceMutationOrigin(): boolean {
  if (process.env.ALLOW_INSECURE_CSRF === "1") return false;

  if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
    return true;
  }

  if (process.env.NODE_ENV === "production") return true;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      const host = new URL(appUrl).hostname.toLowerCase();
      if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]") {
        return true;
      }
    } catch {
      // ignore malformed URL
    }
  }

  return !isLocalDevAuthEnabled();
}
