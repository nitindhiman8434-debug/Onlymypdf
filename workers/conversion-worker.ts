import { isSupabaseConfigured } from "../src/lib/supabase/server";
import { isUpstashConfigured } from "../src/lib/server/upstash-kv";
import { getPdfToWordQueueDepth } from "../src/lib/services/pdf-to-word-jobs.service";
import { processNextPdfToWordJob } from "../src/lib/services/pdf-to-word-worker.service";
import { recordConversionWorkerHeartbeat } from "../src/lib/ops/conversion-worker-health";

const pollMs = Math.max(250, Number(process.env.CONVERSION_WORKER_POLL_MS ?? "1000"));
let stopping = false;
let lastHeartbeatAt = 0;

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

async function main() {
  if (!isUpstashConfigured() || !isSupabaseConfigured()) {
    throw new Error("The production worker requires Upstash Redis and Supabase storage.");
  }

  console.log("[conversion-worker] ready", await getPdfToWordQueueDepth());
  await heartbeat({ state: "ready" }, true);
  while (!stopping) {
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
