import { timingSafeEqualString } from "@/lib/security/timing-safe";

export function isCronAuthorized(
  authHeader: string | null,
  _vercelCronHeader: string | null,
  cronSecret: string | undefined
): boolean {
  const secret = cronSecret?.trim();
  if (!secret || !authHeader) return false;
  return timingSafeEqualString(authHeader.trim(), `Bearer ${secret}`);
}
