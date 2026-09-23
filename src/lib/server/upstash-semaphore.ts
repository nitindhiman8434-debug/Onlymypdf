import { randomUUID } from "crypto";
import { getMaxConcurrentHeavyJobs } from "@/lib/config/runtime-limits";
import { getUpstashRedis, isUpstashConfigured } from "@/lib/server/upstash-kv";
import { isSupabaseServiceConfigured } from "@/lib/supabase/server";
import {
  releaseSupabaseHeavyJobLease,
  tryAcquireSupabaseHeavyJobLease,
} from "@/lib/server/supabase-runtime-coordination";

const SEMAPHORE_KEY = "pdf-doctor:heavy-jobs:leases";
const LEASE_MS = 10 * 60 * 1000;
const POLL_MS = 1000;
const WAIT_TIMEOUT_MS = 120_000;

const ACQUIRE_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local maxJobs = tonumber(ARGV[2])
local leaseId = ARGV[3]
local expireAt = tonumber(ARGV[4])
redis.call('ZREMRANGEBYSCORE', key, '-inf', now)
local active = redis.call('ZCARD', key)
if active < maxJobs then
  redis.call('ZADD', key, expireAt, leaseId)
  return 1
end
return 0
`;

const RELEASE_SCRIPT = `
return redis.call('ZREM', KEYS[1], ARGV[1])
`;

async function tryAcquireLease(): Promise<string | null> {
  const leaseId = randomUUID();
  const max = getMaxConcurrentHeavyJobs();

  if (isSupabaseServiceConfigured()) {
    const acquired = await tryAcquireSupabaseHeavyJobLease(
      leaseId,
      max,
      Math.ceil(LEASE_MS / 1000)
    );
    return acquired ? leaseId : null;
  }

  const redis = await getUpstashRedis();
  if (!redis) return null;

  const now = Date.now();
  const expireAt = now + LEASE_MS;

  const acquired = (await redis.eval(
    ACQUIRE_SCRIPT,
    [SEMAPHORE_KEY],
    [String(now), String(max), leaseId, String(expireAt)]
  )) as number;

  return acquired === 1 ? leaseId : null;
}

export async function releaseHeavyJobLease(leaseId: string): Promise<void> {
  if (isSupabaseServiceConfigured()) {
    await releaseSupabaseHeavyJobLease(leaseId);
    return;
  }
  const redis = await getUpstashRedis();
  if (!redis) return;
  await redis.eval(RELEASE_SCRIPT, [SEMAPHORE_KEY], [leaseId]);
}

/** Acquire a distributed heavy-job slot; polls until timeout. */
export async function acquireHeavyJobLease(): Promise<string | null> {
  if (!isDistributedSemaphoreEnabled()) return null;

  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const leaseId = await tryAcquireLease();
    if (leaseId) return leaseId;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return null;
}

export function isDistributedSemaphoreEnabled(): boolean {
  return isSupabaseServiceConfigured() || isUpstashConfigured();
}
