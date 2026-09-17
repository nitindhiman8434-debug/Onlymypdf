import { NextRequest, NextResponse } from "next/server";
import {
  cleanupExpiredFiles,
  cleanupExpiredTempSessions,
  purgeExpiredConsentRecords,
  purgeOldUsageLogs,
  purgeOldAiUsageLogs,
  purgeOldErrorLogs,
} from "@/lib/services/cleanup.service";
import { releaseStaleProcessingPayments, downgradeExpiredProProfiles } from "@/lib/db/queries";
import { purgeOldAdminAuditLogs } from "@/lib/admin/purge-audit-logs";
import { isCronAuthorized } from "@/lib/ops/cron-auth";
import { captureApiError, toSafeApiError } from "@/lib/server/safe-error";

export async function GET(request: NextRequest) {
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

    const result = await cleanupExpiredFiles();
    const tempSessions = await cleanupExpiredTempSessions();
    const stalePayments = await releaseStaleProcessingPayments();
    const proDowngraded = await downgradeExpiredProProfiles();
    const auditLogsPurged = await purgeOldAdminAuditLogs();
    const consentPurged = await purgeExpiredConsentRecords();
    const usageLogsPurged = await purgeOldUsageLogs();
    const aiUsageLogsPurged = await purgeOldAiUsageLogs();
    const errorLogsPurged = await purgeOldErrorLogs();

    return NextResponse.json({
      deleted: result.deleted,
      failed: result.failed,
      batches: result.batches,
      temp_sessions_deleted: tempSessions.deleted,
      temp_sessions_failed: tempSessions.failed,
      temp_sessions_scanned: tempSessions.scanned,
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
    captureApiError(err, { route: "cron/cleanup" });
    return NextResponse.json(
      { error: toSafeApiError(err, "Cleanup cron failed") },
      { status: 500 }
    );
  }
}
