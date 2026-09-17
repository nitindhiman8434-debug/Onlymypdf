import { createServiceClient } from "@/lib/supabase/server";
import { PDF_SESSION_TTL_MS } from "@/lib/pdf/pdf-session-store";
import { getExpiredFiles, markFileDeleted, logError, purgeOldConsentRecords, purgeOldUsageLogs as purgeOldUsageLogsFromDb, purgeOldAiUsageLogs as purgeOldAiUsageLogsFromDb, purgeOldErrorLogs as purgeOldErrorLogsFromDb } from "@/lib/db/queries";

const STORAGE_BUCKET = "pdf-files";
const BATCH_SIZE = 200;
const STORAGE_DELETE_CHUNK = 20;
const TEMP_SESSION_PREFIX = "temp-sessions/pdf";
const CONVERSION_JOB_PREFIX = "temp-jobs/pdf-to-word";
const TEMP_SESSION_LIST_LIMIT = 100;
const CONVERSION_JOB_TTL_MS = 2 * 60 * 60 * 1000;

export async function cleanupExpiredFiles(): Promise<{
  deleted: number;
  failed: number;
  batches: number;
}> {
  let deleted = 0;
  let failed = 0;
  let batches = 0;

  try {
    const supabase = await createServiceClient();

    while (true) {
      const expiredFiles = await getExpiredFiles(BATCH_SIZE);
      if (expiredFiles.length === 0) break;

      batches += 1;

      for (let i = 0; i < expiredFiles.length; i += STORAGE_DELETE_CHUNK) {
        const chunk = expiredFiles.slice(i, i + STORAGE_DELETE_CHUNK);
        const paths = chunk.map((f) => f.storage_path);

        try {
          const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
          if (error) {
            failed += chunk.length;
            continue;
          }

          await Promise.all(chunk.map((file) => markFileDeleted(file.id)));
          deleted += chunk.length;
        } catch (err) {
          failed += chunk.length;
          await logError({
            tool_name: "cleanup",
            error_type: "FILE_CLEANUP_CHUNK_FAILED",
            error_message: err instanceof Error ? err.message : String(err),
            metadata: { paths },
          });
        }
      }

      if (expiredFiles.length < BATCH_SIZE) break;
    }
  } catch (err) {
    await logError({
      tool_name: "cleanup",
      error_type: "CLEANUP_BATCH_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
      stack_trace: err instanceof Error ? err.stack : undefined,
    });
  }

  return { deleted, failed, batches };
}

function storageObjectAgeMs(entry: { created_at?: string | null; updated_at?: string | null }): number {
  const stamp = entry.created_at ?? entry.updated_at;
  if (!stamp) return 0;
  const ms = new Date(stamp).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Remove preview PDFs under temp-sessions/pdf/ older than the session TTL. */
export async function cleanupExpiredTempSessions(): Promise<{
  deleted: number;
  failed: number;
  scanned: number;
}> {
  let deleted = 0;
  let failed = 0;
  let scanned = 0;

  try {
    const supabase = await createServiceClient();
    const cutoff = Date.now() - PDF_SESSION_TTL_MS;
    let offset = 0;

    while (true) {
      const { data: entries, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list(TEMP_SESSION_PREFIX, {
          limit: TEMP_SESSION_LIST_LIMIT,
          offset,
          sortBy: { column: "created_at", order: "asc" },
        });

      if (error) {
        await logError({
          tool_name: "cleanup",
          error_type: "TEMP_SESSION_LIST_FAILED",
          error_message: error.message,
        });
        break;
      }

      if (!entries?.length) break;

      const stalePaths: string[] = [];
      for (const entry of entries) {
        if (!entry.name || entry.id === null) continue;
        scanned += 1;
        const ageMs = storageObjectAgeMs(entry);
        if (ageMs > 0 && ageMs < cutoff) {
          stalePaths.push(`${TEMP_SESSION_PREFIX}/${entry.name}`);
        }
      }

      for (let i = 0; i < stalePaths.length; i += STORAGE_DELETE_CHUNK) {
        const chunk = stalePaths.slice(i, i + STORAGE_DELETE_CHUNK);
        try {
          const { error: removeError } = await supabase.storage.from(STORAGE_BUCKET).remove(chunk);
          if (removeError) {
            failed += chunk.length;
            continue;
          }
          deleted += chunk.length;
        } catch (err) {
          failed += chunk.length;
          await logError({
            tool_name: "cleanup",
            error_type: "TEMP_SESSION_DELETE_FAILED",
            error_message: err instanceof Error ? err.message : String(err),
            metadata: { paths: chunk },
          });
        }
      }

      if (entries.length < TEMP_SESSION_LIST_LIMIT) break;
      offset += entries.length;
    }
  } catch (err) {
    await logError({
      tool_name: "cleanup",
      error_type: "TEMP_SESSION_CLEANUP_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
      stack_trace: err instanceof Error ? err.stack : undefined,
    });
  }

  return { deleted, failed, scanned };
}

/** Remove staged queue inputs/outputs even if the API or worker crashed. */
export async function cleanupExpiredConversionJobs(): Promise<{
  deleted: number;
  failed: number;
  scanned: number;
}> {
  let deleted = 0;
  let failed = 0;
  let scanned = 0;
  try {
    const supabase = await createServiceClient();
    const cutoff = Date.now() - CONVERSION_JOB_TTL_MS;
    const { data: entries, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(CONVERSION_JOB_PREFIX, {
        limit: 1_000,
        sortBy: { column: "created_at", order: "asc" },
      });
    if (error) throw error;

    const stalePaths: string[] = [];
    for (const entry of entries ?? []) {
      if (!entry.name) continue;
      if (entry.id !== null) {
        scanned += 1;
        const stamp = storageObjectAgeMs(entry);
        if (stamp > 0 && stamp < cutoff) {
          stalePaths.push(`${CONVERSION_JOB_PREFIX}/${entry.name}`);
        }
        continue;
      }

      const folder = `${CONVERSION_JOB_PREFIX}/${entry.name}`;
      const { data: children, error: childError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list(folder, { limit: 20 });
      if (childError) {
        failed += 1;
        continue;
      }
      for (const child of children ?? []) {
        if (!child.name || child.id === null) continue;
        scanned += 1;
        const stamp = storageObjectAgeMs(child);
        if (stamp > 0 && stamp < cutoff) stalePaths.push(`${folder}/${child.name}`);
      }
    }

    for (let index = 0; index < stalePaths.length; index += STORAGE_DELETE_CHUNK) {
      const chunk = stalePaths.slice(index, index + STORAGE_DELETE_CHUNK);
      const { error: removeError } = await supabase.storage.from(STORAGE_BUCKET).remove(chunk);
      if (removeError) failed += chunk.length;
      else deleted += chunk.length;
    }
  } catch (err) {
    await logError({
      tool_name: "cleanup",
      error_type: "CONVERSION_JOB_CLEANUP_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
      stack_trace: err instanceof Error ? err.stack : undefined,
    });
    failed += 1;
  }
  return { deleted, failed, scanned };
}

export async function purgeExpiredConsentRecords(): Promise<number> {
  try {
    return await purgeOldConsentRecords(3);
  } catch (err) {
    await logError({
      tool_name: "cleanup",
      error_type: "CONSENT_PURGE_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

export async function purgeOldUsageLogs(): Promise<number> {
  try {
    return await purgeOldUsageLogsFromDb(90);
  } catch (err) {
    await logError({
      tool_name: "cleanup",
      error_type: "USAGE_LOG_PURGE_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

export async function purgeOldAiUsageLogs(): Promise<number> {
  try {
    return await purgeOldAiUsageLogsFromDb(90);
  } catch (err) {
    await logError({
      tool_name: "cleanup",
      error_type: "AI_USAGE_LOG_PURGE_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

export async function purgeOldErrorLogs(): Promise<number> {
  try {
    return await purgeOldErrorLogsFromDb(90);
  } catch (err) {
    await logError({
      tool_name: "cleanup",
      error_type: "ERROR_LOG_PURGE_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

export async function getCleanupStats(): Promise<{
  pendingCleanup: number;
  totalDeleted: number;
}> {
  try {
    const supabase = await createServiceClient();

    const [{ count: pendingCleanup }, { count: totalDeleted }] =
      await Promise.all([
        supabase
          .from("uploaded_files")
          .select("id", { count: "exact", head: true })
          .eq("is_deleted", false)
          .lt("expires_at", new Date().toISOString()),
        supabase
          .from("uploaded_files")
          .select("id", { count: "exact", head: true })
          .eq("is_deleted", true),
      ]);

    return {
      pendingCleanup: pendingCleanup ?? 0,
      totalDeleted: totalDeleted ?? 0,
    };
  } catch (err) {
    await logError({
      tool_name: "cleanup",
      error_type: "CLEANUP_STATS_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return { pendingCleanup: 0, totalDeleted: 0 };
  }
}
