import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/ops/cron-auth";
import { toSafeApiError } from "@/lib/server/safe-error";
import { drainPdfToWordQueue } from "@/lib/services/pdf-to-word-worker.service";
import { getPdfToWordQueueDepth } from "@/lib/services/pdf-to-word-jobs.service";
import { recordConversionWorkerHeartbeat } from "@/lib/ops/conversion-worker-health";

export const maxDuration = 600;

export async function GET(request: NextRequest) {
  if (
    !isCronAuthorized(
      request.headers.get("authorization"),
      request.headers.get("x-vercel-cron"),
      process.env.CRON_SECRET
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await recordConversionWorkerHeartbeat({ state: "ready" });
    const requested = Number(request.nextUrl.searchParams.get("maxJobs") ?? "1");
    const results = await drainPdfToWordQueue(requested);
    const lastProcessed = [...results].reverse().find((result) => result.processed);
    await recordConversionWorkerHeartbeat(
      lastProcessed
        ? {
            state: "processed",
            jobId: lastProcessed.jobId,
            result: lastProcessed.status,
          }
        : { state: "idle" }
    );
    return NextResponse.json({
      results,
      queue: await getPdfToWordQueueDepth(),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    await recordConversionWorkerHeartbeat({ state: "error" }).catch(() => undefined);
    return NextResponse.json(
      { error: toSafeApiError(error, "Conversion worker failed") },
      { status: 500 }
    );
  }
}
