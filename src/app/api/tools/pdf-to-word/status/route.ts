import { guardPollRateLimit } from "@/lib/server/rate-limiter";

import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";

import { getPdfToWordJob } from "@/lib/services/pdf-to-word-jobs.service";

import { assertJobOwner, resolveToolJobOwnerKey } from "@/lib/server/job-owner";
import { guardSensitiveReadOrigin } from "@/lib/server/mutation-origin";



export async function GET(request: NextRequest) {

  const originBlocked = guardSensitiveReadOrigin(request);
  if (originBlocked) return originBlocked;

  const rateLimited = await guardPollRateLimit(request, "pdf-to-word");

  if (rateLimited) return rateLimited;



  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {

    return toolJsonError(request, "jobId is required", 400);

  }



  const ownerKey = await resolveToolJobOwnerKey(request);

  const job = await getPdfToWordJob(jobId);



  if (!job) {

    return toolJsonError(request, "Job not found or expired", 404);

  }



  if (!assertJobOwner(job.ownerKey, ownerKey)) {

    return toolJsonError(request, "Access denied", 403);

  }



  return NextResponse.json({

    progress: job.progress,

    status: job.status,

    error: job.error ?? null,

    engine: job.engine ?? null,
    queueTimeMs: job.queueTimeMs ?? null,
    processingTimeMs: job.processingTimeMs ?? null,
    attemptedEngines: job.attemptedEngines ?? [],
    outputValid: job.outputValidation?.valid ?? null,

  });

}
