import {
  isSupabaseConfigured,
  isSupabaseServiceConfigured,
} from "../src/lib/supabase/server";
import { getConversionQueueProvider } from "../src/lib/services/conversion-queue-provider";
import { getPdfToWordQueueDepth } from "../src/lib/services/pdf-to-word-jobs.service";
import { processNextPdfToWordJob } from "../src/lib/services/pdf-to-word-worker.service";
import { recordConversionWorkerHeartbeat } from "../src/lib/ops/conversion-worker-health";
import {
  finishCleanupRun,
  startCleanupRun,
} from "../src/lib/ops/conversion-telemetry";
import { cleanupExpiredConversionJobs } from "../src/lib/services/cleanup.service";
import { cleanupExpiredSupabaseRuntimeRecords } from "../src/lib/server/supabase-runtime-coordination";

const minPollMs = Math.max(500, Number(process.env.CONVERSION_WORKER_POLL_MS ?? "1000"));
const maxPollMs = Math.max(
  minPollMs,
  Number(process.env.CONVERSION_WORKER_MAX_POLL_MS ?? "30000")
);
const heartbeatIntervalMs = Math.max(
  30_000,
  Number(process.env.CONVERSION_WORKER_HEARTBEAT_MS ?? "60000")
);
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
  if (!force && now - lastHeartbeatAt < heartbeatIntervalMs) return;
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
    if (isSupabaseServiceConfigured()) {
      await cleanupExpiredSupabaseRuntimeRecords();
    }
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
  const provider = getConversionQueueProvider();
  if (provider === "unavailable") {
    throw new Error("The configured conversion queue provider is unavailable.");
  }
  if (process.env.NODE_ENV === "production" && (provider === "memory" || !isSupabaseConfigured())) {
    throw new Error("The production worker requires a durable queue and Supabase storage.");
  }

  try {
    console.log("[conversion-worker] ready", {
      provider,
      ...(await getPdfToWordQueueDepth()),
    });
    await heartbeat({ state: "ready" }, true);
  } catch (error) {
    console.error("[conversion-worker] queue unavailable at startup; retrying with backoff", error);
  }
  let idlePollMs = minPollMs;
  while (!stopping) {
    if (Date.now() >= nextCleanupAt) await runScheduledCleanup();
    try {
      const result = await processNextPdfToWordJob();
      if (result.processed) {
        idlePollMs = minPollMs;
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
        await new Promise((resolve) => setTimeout(resolve, idlePollMs));
        idlePollMs = Math.min(maxPollMs, Math.ceil(idlePollMs * 1.5));
      }
    } catch (error) {
      console.error(
        `[conversion-worker] queue poll failed; retrying in ${maxPollMs}ms`,
        error
      );
      await recordConversionWorkerHeartbeat({ state: "error" }).catch(() => undefined);
      idlePollMs = maxPollMs;
      await new Promise((resolve) => setTimeout(resolve, maxPollMs));
    }
  }
  await heartbeat({ state: "stopping" }, true).catch(() => undefined);
  console.log("[conversion-worker] stopped");
}

main().catch((error) => {
  console.error("[conversion-worker] fatal", error);
  void recordConversionWorkerHeartbeat({ state: "error" }).catch(() => undefined);
  process.exitCode = 1;
});
