import { NextRequest, NextResponse } from "next/server";
import {
  cleanupExpiredFiles,
  cleanupExpiredTempSessions,
  cleanupExpiredConversionJobs,
  purgeExpiredConsentRecords,
  purgeOldUsageLogs,
  purgeOldAiUsageLogs,
  purgeOldErrorLogs,
} from "@/lib/services/cleanup.service";
import { releaseStaleProcessingPayments, downgradeExpiredProProfiles } from "@/lib/db/queries";
import { purgeOldAdminAuditLogs } from "@/lib/admin/purge-audit-logs";
import { isCronAuthorized } from "@/lib/ops/cron-auth";
import { captureApiError, toSafeApiError } from "@/lib/server/safe-error";
import {
  finishCleanupRun,
  startCleanupRun,
} from "@/lib/ops/conversion-telemetry";

export async function GET(request: NextRequest) {
  let telemetryRun: Awaited<ReturnType<typeof startCleanupRun>> | null = null;
  try {
    if (
      !isCronAuthorized(
        request.headers.get("authorization"),
        request.headers.get("x-vercel-cron"),
        process.env.CRON_SECRET
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    telemetryRun = await startCleanupRun();

    const result = await cleanupExpiredFiles();
    const tempSessions = await cleanupExpiredTempSessions();
    const conversionJobs = await cleanupExpiredConversionJobs();
    const stalePayments = await releaseStaleProcessingPayments();
    const proDowngraded = await downgradeExpiredProProfiles();
    const auditLogsPurged = await purgeOldAdminAuditLogs();
    const consentPurged = await purgeExpiredConsentRecords();
    const usageLogsPurged = await purgeOldUsageLogs();
    const aiUsageLogsPurged = await purgeOldAiUsageLogs();
    const errorLogsPurged = await purgeOldErrorLogs();

    await finishCleanupRun(telemetryRun, {
      status:
        result.failed > 0 || tempSessions.failed > 0 || conversionJobs.failed > 0
          ? "failed"
          : "completed",
      filesDeleted: result.deleted,
      filesFailed: result.failed,
      tempSessionsDeleted: tempSessions.deleted,
      tempSessionsFailed: tempSessions.failed,
      conversionJobsDeleted: conversionJobs.deleted,
      conversionJobsFailed: conversionJobs.failed,
      ...(result.failed > 0 || tempSessions.failed > 0 || conversionJobs.failed > 0
        ? { errorCode: "PARTIAL_DELETE_FAILURE" }
        : {}),
    });

    return NextResponse.json({
      deleted: result.deleted,
      failed: result.failed,
      batches: result.batches,
      temp_sessions_deleted: tempSessions.deleted,
      temp_sessions_failed: tempSessions.failed,
      temp_sessions_scanned: tempSessions.scanned,
      conversion_jobs_deleted: conversionJobs.deleted,
      conversion_jobs_failed: conversionJobs.failed,
      conversion_jobs_scanned: conversionJobs.scanned,
      stale_payments_reset: stalePayments,
      pro_profiles_downgraded: proDowngraded,
      admin_audit_logs_purged: auditLogsPurged,
      consent_records_purged: consentPurged,
      usage_logs_purged: usageLogsPurged,
      ai_usage_logs_purged: aiUsageLogsPurged,
      error_logs_purged: errorLogsPurged,
      cleaned_at: new Date().toISOString(),
    });
  } catch (err) {
    if (telemetryRun) {
      await finishCleanupRun(telemetryRun, {
        status: "failed",
        filesDeleted: 0,
        filesFailed: 0,
        tempSessionsDeleted: 0,
        tempSessionsFailed: 0,
        conversionJobsDeleted: 0,
        conversionJobsFailed: 0,
        errorCode: err instanceof Error ? err.name : "CLEANUP_FAILED",
      });
    }
    captureApiError(err, { route: "cron/cleanup" });
    return NextResponse.json(
      { error: toSafeApiError(err, "Cleanup cron failed") },
      { status: 500 }
    );
  }
}
