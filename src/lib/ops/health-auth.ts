import type { NextRequest } from "next/server";
import { timingSafeEqualString } from "@/lib/security/timing-safe";

function healthSecrets(): string[] {
  const dedicated = process.env.HEALTH_CHECK_SECRET?.trim();
  return dedicated ? [dedicated] : [];
}

/** Authorize detailed health diagnostics (Bearer secret or x-health-key header). */
export function isHealthDetailAuthorized(request: NextRequest): boolean {
  const secrets = healthSecrets();
  if (secrets.length === 0) return false;

  const auth = request.headers.get("authorization");
  const healthKey = request.headers.get("x-health-key")?.trim();
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";

  return secrets.some(
    (secret) =>
      (token ? timingSafeEqualString(token, secret) : false) ||
      (healthKey ? timingSafeEqualString(healthKey, secret) : false)
  );
}
