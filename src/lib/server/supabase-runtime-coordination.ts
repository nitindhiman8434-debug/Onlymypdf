import { createServiceClient } from "@/lib/supabase/server";

type RateLimitRow = {
  allowed: boolean;
  remaining: number | string;
  retry_after_seconds: number | string;
};

function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

function coordinationError(operation: string, error: { message?: string } | null): Error {
  return new Error(`Supabase runtime coordination ${operation} failed: ${error?.message ?? "unknown error"}`);
}

export async function checkSupabaseRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; retryAfterSec: number }> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("check_runtime_rate_limit", {
    p_key: key,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });
  if (error) throw coordinationError("rate limit", error);
  const row = firstRow(data as RateLimitRow | RateLimitRow[] | null);
  if (!row) throw coordinationError("rate limit", { message: "empty response" });
  return {
    allowed: Boolean(row.allowed),
    remaining: Number(row.remaining),
    retryAfterSec: Number(row.retry_after_seconds),
  };
}

export async function tryAcquireSupabaseHeavyJobLease(
  leaseId: string,
  maxJobs: number,
  leaseSeconds: number
): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("try_acquire_heavy_job_lease", {
    p_lease_id: leaseId,
    p_max_jobs: maxJobs,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw coordinationError("lease acquire", error);
  return data === true;
}

export async function releaseSupabaseHeavyJobLease(leaseId: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.rpc("release_heavy_job_lease", {
    p_lease_id: leaseId,
  });
  if (error) throw coordinationError("lease release", error);
}

export async function claimSupabaseOneTimeKey(key: string, ttlSeconds: number): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("claim_runtime_one_time_key", {
    p_key: key,
    p_ttl_seconds: ttlSeconds,
  });
  if (error) throw coordinationError("one-time claim", error);
  return data === true;
}

export async function cleanupExpiredSupabaseRuntimeRecords(): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.rpc("cleanup_expired_runtime_records");
  if (error) throw coordinationError("cleanup", error);
}
