import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isProductionReady } from "@/lib/config/env-security";
import { isConvertApiAvailable } from "@/lib/services/pdf-to-word-convertapi.service";
import { isConvertApiOnlyMode } from "@/lib/services/pdf-to-word-engine-plan";
import { getCleanupStats } from "@/lib/services/cleanup.service";
import { isHealthDetailAuthorized } from "@/lib/ops/health-auth";
import {
  isLibreOfficeAvailable,
  LIBREOFFICE_TOOLS,
  resolveLibreOfficeBinary,
} from "@/lib/services/libreoffice-core.service";
import { isUpstashConfigured } from "@/lib/server/upstash-kv";
import {
  getCleanupOperationalStatus,
  getConversionOperationalMetrics,
} from "@/lib/ops/conversion-telemetry";
import { getPdfToWordQueueDepth } from "@/lib/services/pdf-to-word-jobs.service";

export const dynamic = "force-dynamic";

function publicStatus(): { status: string; httpStatus: number } {
  if (process.env.NODE_ENV !== "production") {
    return { status: "ok", httpStatus: 200 };
  }
  if (!isSupabaseConfigured() || !isProductionReady() || !isUpstashConfigured()) {
    return { status: "degraded", httpStatus: 200 };
  }
  return { status: "ok", httpStatus: 200 };
}

export async function GET(request: NextRequest) {
  const detailed = isHealthDetailAuthorized(request);
  const pub = publicStatus();

  if (!detailed) {
    return NextResponse.json(
      {
        status: pub.status,
        timestamp: new Date().toISOString(),
      },
      { status: pub.httpStatus }
    );
  }

  const checks: Record<string, { ok: boolean; detail?: string }> = {
    app: { ok: true },
    secrets: { ok: isProductionReady() },
    upstash: {
      ok: isUpstashConfigured(),
      detail: "Required for distributed rate limits in production",
    },
    libreoffice: {
      ok: isLibreOfficeAvailable(),
      detail: isLibreOfficeAvailable()
        ? `${resolveLibreOfficeBinary()} — powers ${LIBREOFFICE_TOOLS.join(", ")}`
        : "Install LibreOffice or set LIBREOFFICE_PATH for high-accuracy Office↔PDF",
    },
    convertapi: {
      ok: isConvertApiAvailable(),
      detail: isConvertApiAvailable()
        ? isConvertApiOnlyMode()
          ? "Primary PDF→Word engine (cloud, convertapi-only mode)"
          : "Primary PDF→Word engine (cloud)"
        : "Set CONVERTAPI_SECRET for Smallpdf-class PDF→Word at scale",
    },
  };

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServiceClient();
      const { error } = await supabase.from("user_profiles").select("id").limit(1);
      checks.database = { ok: !error, detail: error?.message };
    } catch (err) {
      checks.database = {
        ok: false,
        detail: err instanceof Error ? err.message : "Database unreachable",
      };
    }

    try {
      const stats = await getCleanupStats();
      checks.storage_cleanup = {
        ok: stats.pendingCleanup < 10_000,
        detail: `pending=${stats.pendingCleanup} deleted_total=${stats.totalDeleted}`,
      };
    } catch (err) {
      checks.storage_cleanup = {
        ok: false,
        detail: err instanceof Error ? err.message : "Cleanup stats failed",
      };
    }
  } else {
    checks.database = { ok: false, detail: "Supabase not configured" };
  }

  let conversionMetrics = null;
  let cleanupOperational = null;
  let conversionQueue = null;
  try {
    [conversionMetrics, cleanupOperational, conversionQueue] = await Promise.all([
      getConversionOperationalMetrics(24),
      getCleanupOperationalStatus(),
      getPdfToWordQueueDepth(),
    ]);
    const cleanupAgeMs = cleanupOperational?.completedAt
      ? Date.now() - new Date(cleanupOperational.completedAt).getTime()
      : Number.POSITIVE_INFINITY;
    checks.conversion_queue = {
      ok: conversionQueue.processing < getMaxExpectedProcessingJobs(),
      detail: `pending=${conversionQueue.pending} processing=${conversionQueue.processing}`,
    };
    checks.conversion_outputs = {
      ok:
        conversionMetrics.validOutputRate === null ||
        conversionMetrics.validOutputRate >= 99.5,
      detail: `jobs_24h=${conversionMetrics.jobs} success=${conversionMetrics.successRate ?? "n/a"}% valid=${conversionMetrics.validOutputRate ?? "n/a"}% p95=${conversionMetrics.processingP95Ms ?? "n/a"}ms fallback=${conversionMetrics.fallbackRate ?? "n/a"}%`,
    };
    checks.cleanup_last_run = {
      ok:
        process.env.NODE_ENV !== "production" ||
        (cleanupOperational?.status === "completed" && cleanupAgeMs <= 2 * 60 * 60 * 1000),
      detail: cleanupOperational
        ? `status=${cleanupOperational.status} completed=${cleanupOperational.completedAt ?? "running"} failed=${cleanupOperational.filesFailed + cleanupOperational.tempSessionsFailed + cleanupOperational.conversionJobsFailed}`
        : "No cleanup run recorded",
    };
  } catch (err) {
    checks.operations = {
      ok: false,
      detail: err instanceof Error ? err.message : "Operational metrics unavailable",
    };
  }

  const isProd = process.env.NODE_ENV === "production";
  const allCriticalOk =
    checks.app.ok &&
    checks.secrets.ok &&
    (checks.database?.ok ?? false) &&
    (!isProd || checks.upstash.ok);

  const status = allCriticalOk ? 200 : 503;

  return NextResponse.json(
    {
      status: allCriticalOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
      operations: {
        conversions24h: conversionMetrics,
        cleanup: cleanupOperational,
        queue: conversionQueue,
      },
    },
    { status }
  );
}

function getMaxExpectedProcessingJobs(): number {
  const parsed = Number(process.env.MAX_CONCURRENT_HEAVY_JOBS ?? "8");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) + 1 : 9;
}
