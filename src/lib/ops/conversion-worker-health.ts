import { getUpstashRedis, isUpstashConfigured, upstashGetJson } from "@/lib/server/upstash-kv";

const HEARTBEAT_KEY = "pdf-to-word:worker:heartbeat";
const HEARTBEAT_TTL_SECONDS = 90;
const MAX_HEARTBEAT_AGE_MS = 60_000;

export type ConversionWorkerState = "ready" | "idle" | "processed" | "stopping" | "error";

export type ConversionWorkerHeartbeat = {
  recordedAt: string;
  state: ConversionWorkerState;
  jobId?: string;
  result?: "completed" | "failed";
};

function localHeartbeatStore(): { value: ConversionWorkerHeartbeat | null } {
  const root = globalThis as typeof globalThis & {
    __conversionWorkerHeartbeat?: { value: ConversionWorkerHeartbeat | null };
  };
  if (!root.__conversionWorkerHeartbeat) {
    root.__conversionWorkerHeartbeat = { value: null };
  }
  return root.__conversionWorkerHeartbeat;
}

export async function recordConversionWorkerHeartbeat(
  input: Omit<ConversionWorkerHeartbeat, "recordedAt">,
  now = new Date()
): Promise<void> {
  const heartbeat: ConversionWorkerHeartbeat = {
    ...input,
    recordedAt: now.toISOString(),
  };
  localHeartbeatStore().value = heartbeat;

  const redis = await getUpstashRedis();
  if (redis) {
    await redis.set(HEARTBEAT_KEY, JSON.stringify(heartbeat), {
      ex: HEARTBEAT_TTL_SECONDS,
    });
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("Conversion worker heartbeat requires Upstash Redis in production.");
  }
}

export async function getConversionWorkerHealth(nowMs = Date.now()): Promise<{
  ok: boolean;
  detail: string;
  heartbeat: ConversionWorkerHeartbeat | null;
}> {
  const heartbeat = isUpstashConfigured()
    ? await upstashGetJson<ConversionWorkerHeartbeat>(HEARTBEAT_KEY)
    : localHeartbeatStore().value;

  if (!heartbeat) {
    return {
      ok: process.env.NODE_ENV !== "production",
      detail: "No conversion worker heartbeat recorded",
      heartbeat: null,
    };
  }

  const recordedAt = Date.parse(heartbeat.recordedAt);
  const ageMs = Number.isFinite(recordedAt) ? Math.max(0, nowMs - recordedAt) : Infinity;
  const fresh = ageMs <= MAX_HEARTBEAT_AGE_MS;
  const healthyState = heartbeat.state !== "error" && heartbeat.state !== "stopping";
  return {
    ok: fresh && healthyState,
    detail: `state=${heartbeat.state} age_ms=${Number.isFinite(ageMs) ? ageMs : "invalid"}${heartbeat.jobId ? ` job=${heartbeat.jobId}` : ""}`,
    heartbeat,
  };
}
