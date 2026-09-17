import { isSupabaseConfigured } from "../src/lib/supabase/server";
import { isUpstashConfigured } from "../src/lib/server/upstash-kv";
import { getPdfToWordQueueDepth } from "../src/lib/services/pdf-to-word-jobs.service";
import { processNextPdfToWordJob } from "../src/lib/services/pdf-to-word-worker.service";
import { recordConversionWorkerHeartbeat } from "../src/lib/ops/conversion-worker-health";
import {
  finishCleanupRun,
  startCleanupRun,
} from "../src/lib/ops/conversion-telemetry";
import { cleanupExpiredConversionJobs } from "../src/lib/services/cleanup.service";

const pollMs = Math.max(250, Number(process.env.CONVERSION_WORKER_POLL_MS ?? "1000"));
const cleanupIntervalMs = Math.max(
  5 * 60 * 1000,
  Number(process.env.CONVERSION_CLEANUP_INTERVAL_MS ?? 60 * 60 * 1000)
);
let stopping = false;
let lastHeartbeatAt = 0;
let nextCleanupAt = 0;

async function heartbeat(
  input: Parameters<typeof recordConversionWorkerHeartbeat>[0],
  force = false
) {
  const now = Date.now();
  if (!force && now - lastHeartbeatAt < 15_000) return;
  await recordConversionWorkerHeartbeat(input);
  lastHeartbeatAt = now;
}

process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

async function runScheduledCleanup() {
  const telemetryRun = await startCleanupRun();
  try {
    const result = await cleanupExpiredConversionJobs();
    await finishCleanupRun(telemetryRun, {
      status: result.failed > 0 ? "failed" : "completed",
      filesDeleted: 0,
      filesFailed: 0,
      tempSessionsDeleted: 0,
      tempSessionsFailed: 0,
      conversionJobsDeleted: result.deleted,
      conversionJobsFailed: result.failed,
      ...(result.failed > 0 ? { errorCode: "CONVERSION_STORAGE_DELETE_FAILED" } : {}),
    });
    console.log("[conversion-worker] cleanup", result);
  } catch (error) {
    await finishCleanupRun(telemetryRun, {
      status: "failed",
      filesDeleted: 0,
      filesFailed: 0,
      tempSessionsDeleted: 0,
      tempSessionsFailed: 0,
      conversionJobsDeleted: 0,
      conversionJobsFailed: 1,
      errorCode: error instanceof Error ? error.name : "CONVERSION_CLEANUP_FAILED",
    });
    console.error("[conversion-worker] cleanup failed", error);
  } finally {
    nextCleanupAt = Date.now() + cleanupIntervalMs;
  }
}

async function main() {
  if (!isUpstashConfigured() || !isSupabaseConfigured()) {
    throw new Error("The production worker requires Upstash Redis and Supabase storage.");
  }

  console.log("[conversion-worker] ready", await getPdfToWordQueueDepth());
  await heartbeat({ state: "ready" }, true);
  while (!stopping) {
    if (Date.now() >= nextCleanupAt) await runScheduledCleanup();
    const result = await processNextPdfToWordJob();
    if (result.processed) {
      await heartbeat(
        {
          state: "processed",
          jobId: result.jobId,
          result: result.status,
        },
        true
      );
    } else {
      await heartbeat({ state: "idle" });
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
  await heartbeat({ state: "stopping" }, true);
  console.log("[conversion-worker] stopped");
}

main().catch((error) => {
  console.error("[conversion-worker] fatal", error);
  void recordConversionWorkerHeartbeat({ state: "error" }).catch(() => undefined);
  process.exitCode = 1;
});
