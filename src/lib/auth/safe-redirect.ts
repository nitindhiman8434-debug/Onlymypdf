const ALLOWED_NEXT_PREFIXES = [
  "/dashboard",
  "/reset-password",
  "/pricing",
  "/admin",
] as const;

const NEXT_PATH_ALIASES: Record<string, string> = {
  "/account": "/dashboard",
  "/settings": "/dashboard/settings",
};

const BLOCKED_NEXT_PATHS = new Set(["/dashboard/billing"]);

function normalizeRelativePath(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return null;
  }
  if (path.includes("..") || /%2e/i.test(path)) {
    return null;
  }

  try {
    const normalized = new URL(path, "http://localhost").pathname;
    if (normalized.includes("..")) return null;
    return normalized;
  } catch {
    return null;
  }
}

/** Reject open redirects; only allow same-origin relative paths on an allowlist. */
export function resolveSafeNextPath(next: string | null, fallback = "/dashboard"): string {
  if (!next) return fallback;

  const normalized = normalizeRelativePath(next);
  if (!normalized) return fallback;

  if (BLOCKED_NEXT_PATHS.has(normalized)) {
    return fallback;
  }

  const aliased = NEXT_PATH_ALIASES[normalized] ?? normalized;

  const allowed = ALLOWED_NEXT_PREFIXES.some(
    (prefix) => aliased === prefix || aliased.startsWith(`${prefix}/`)
  );

  return allowed ? aliased : fallback;
}
