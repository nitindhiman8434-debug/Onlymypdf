import { isSupabaseConfigured } from "../src/lib/supabase/server";
import { isUpstashConfigured } from "../src/lib/server/upstash-kv";
import { getPdfToWordQueueDepth } from "../src/lib/services/pdf-to-word-jobs.service";
import { processNextPdfToWordJob } from "../src/lib/services/pdf-to-word-worker.service";

const pollMs = Math.max(250, Number(process.env.CONVERSION_WORKER_POLL_MS ?? "1000"));
let stopping = false;

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
  while (!stopping) {
    const result = await processNextPdfToWordJob();
    if (!result.processed) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
  console.log("[conversion-worker] stopped");
}

main().catch((error) => {
  console.error("[conversion-worker] fatal", error);
  process.exitCode = 1;
});
