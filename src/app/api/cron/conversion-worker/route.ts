import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/ops/cron-auth";
import { toSafeApiError } from "@/lib/server/safe-error";
import { drainPdfToWordQueue } from "@/lib/services/pdf-to-word-worker.service";
import { getPdfToWordQueueDepth } from "@/lib/services/pdf-to-word-jobs.service";

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
    const requested = Number(request.nextUrl.searchParams.get("maxJobs") ?? "1");
    const results = await drainPdfToWordQueue(requested);
    return NextResponse.json({
      results,
      queue: await getPdfToWordQueueDepth(),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: toSafeApiError(error, "Conversion worker failed") },
      { status: 500 }
    );
  }
}
