import { getConversionWorkerHealth } from "../src/lib/ops/conversion-worker-health";
import { getPdfToWordQueueDepth } from "../src/lib/services/pdf-to-word-jobs.service";

async function main() {
  const [worker, queue] = await Promise.all([
    getConversionWorkerHealth(),
    getPdfToWordQueueDepth(),
  ]);
  const forceFailure = process.env.WATCHDOG_FORCE_FAILURE === "1";
  const healthy = worker.ok && !forceFailure;
  const result = {
    checkedAt: new Date().toISOString(),
    healthy,
    worker: worker.detail,
    queue,
    forced: forceFailure,
  };

  if (!healthy) {
    console.error("[conversion-watchdog] unhealthy", result);
    process.exitCode = 1;
    return;
  }
  console.log("[conversion-watchdog] healthy", result);
}

main().catch((error) => {
  console.error("[conversion-watchdog] failed", error);
  process.exitCode = 1;
});
