/** Shared Upstash Redis REST client for distributed job state and rate limits. */

import { isSupabaseServiceConfigured } from "@/lib/supabase/server";
import { claimSupabaseOneTimeKey } from "@/lib/server/supabase-runtime-coordination";

let cachedRedis: import("@upstash/redis").Redis | null | undefined;

export function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

export async function getUpstashRedis(): Promise<import("@upstash/redis").Redis | null> {
  if (cachedRedis !== undefined) return cachedRedis;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    cachedRedis = null;
    return null;
  }

  const { Redis } = await import("@upstash/redis");
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

export async function upstashGetJson<T>(key: string): Promise<T | null> {
  const redis = await getUpstashRedis();
  if (!redis) return null;
  const raw = await redis.get<string>(key);
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return raw as T;
}

export async function upstashSetJson(
  key: string,
  value: unknown,
  ttlSec: number
): Promise<boolean> {
  const redis = await getUpstashRedis();
  if (!redis) return false;
  await redis.set(key, JSON.stringify(value), { ex: ttlSec });
  return true;
}

export async function upstashDel(key: string): Promise<void> {
  const redis = await getUpstashRedis();
  if (!redis) return;
  await redis.del(key);
}

type LocalClaimStore = Map<string, number>;

function localClaimStore(): LocalClaimStore {
  const root = globalThis as typeof globalThis & {
    __upstashFallbackClaims?: LocalClaimStore;
  };
  if (!root.__upstashFallbackClaims) root.__upstashFallbackClaims = new Map();
  return root.__upstashFallbackClaims;
}

/** Claim a short-lived token exactly once. Production uses Redis NX; local dev uses memory. */
export async function claimOneTimeKey(key: string, ttlSec: number): Promise<boolean> {
  if (isSupabaseServiceConfigured()) {
    return claimSupabaseOneTimeKey(key, ttlSec);
  }
  const redis = await getUpstashRedis();
  if (redis) {
    const result = await redis.set(key, "1", { nx: true, ex: ttlSec });
    return result === "OK";
  }

  if (process.env.NODE_ENV === "production") return false;
  const claims = localClaimStore();
  const now = Date.now();
  for (const [claimKey, expiresAt] of claims.entries()) {
    if (expiresAt <= now) claims.delete(claimKey);
  }
  if (claims.has(key)) return false;
  claims.set(key, now + Math.max(1, ttlSec) * 1000);
  return true;
}
