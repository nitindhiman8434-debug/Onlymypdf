import { aggregateConversionMetrics, type ConversionMetricEvent } from "./conversion-metrics";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

const LOCAL_EVENT_LIMIT = 1_000;

type CleanupStatus = {
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  filesDeleted: number;
  filesFailed: number;
  tempSessionsDeleted: number;
  tempSessionsFailed: number;
  conversionJobsDeleted: number;
  conversionJobsFailed: number;
  durationMs?: number;
  errorCode?: string;
};

type LocalTelemetry = {
  events: ConversionMetricEvent[];
  cleanup?: CleanupStatus;
};

function localTelemetry(): LocalTelemetry {
  const root = globalThis as typeof globalThis & { __conversionTelemetry?: LocalTelemetry };
  if (!root.__conversionTelemetry) root.__conversionTelemetry = { events: [] };
  return root.__conversionTelemetry;
}

export async function recordConversionMetric(event: ConversionMetricEvent): Promise<void> {
  const local = localTelemetry();
  local.events.push(event);
  if (local.events.length > LOCAL_EVENT_LIMIT) {
    local.events.splice(0, local.events.length - LOCAL_EVENT_LIMIT);
  }

  if (!isSupabaseConfigured()) return;
  try {
    const supabase = await createServiceClient();
    const { error } = await supabase.from("conversion_events").insert({
      job_id: event.jobId ?? null,
      tool_name: event.toolName,
      status: event.status,
      engine: event.engine ?? null,
      input_bytes: event.inputBytes ?? null,
      output_bytes: event.outputBytes ?? null,
      queue_time_ms: event.queueTimeMs ?? null,
      processing_time_ms: event.processingTimeMs ?? null,
      attempt_count: Math.max(1, event.attemptCount ?? 1),
      fallback_used: event.fallbackUsed ?? (event.attemptCount ?? 1) > 1,
      output_valid: event.validation?.valid ?? null,
      validation: event.validation ?? null,
      error_code: event.errorCode ?? null,
      created_at: event.occurredAt,
    });
    if (error) console.warn("[conversion-telemetry] insert failed:", error.message);
  } catch (error) {
    console.warn("[conversion-telemetry] insert failed:", error);
  }
}

export async function getConversionOperationalMetrics(windowHours = 24) {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServiceClient();
      const { data, error } = await supabase
        .from("conversion_events")
        .select(
          "job_id, tool_name, status, engine, input_bytes, output_bytes, queue_time_ms, processing_time_ms, attempt_count, fallback_used, validation, error_code, created_at"
        )
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(10_000);
      if (error) throw error;
      const events: ConversionMetricEvent[] = (data ?? []).map((row) => ({
        jobId: row.job_id ?? undefined,
        toolName: row.tool_name,
        status: row.status as ConversionMetricEvent["status"],
        engine: row.engine,
        inputBytes: row.input_bytes,
        outputBytes: row.output_bytes,
        queueTimeMs: row.queue_time_ms,
        processingTimeMs: row.processing_time_ms,
        attemptCount: row.attempt_count,
        fallbackUsed: row.fallback_used,
        validation: row.validation,
        errorCode: row.error_code,
        occurredAt: row.created_at,
      }));
      return aggregateConversionMetrics(events, windowHours);
    } catch (error) {
      console.warn("[conversion-telemetry] read failed:", error);
    }
  }

  const events = localTelemetry().events.filter((event) => event.occurredAt >= cutoff);
  return aggregateConversionMetrics(events, windowHours);
}

export async function startCleanupRun(): Promise<{ id: string | null; startedAt: string }> {
  const startedAt = new Date().toISOString();
  localTelemetry().cleanup = {
    status: "running",
    startedAt,
    filesDeleted: 0,
    filesFailed: 0,
    tempSessionsDeleted: 0,
    tempSessionsFailed: 0,
    conversionJobsDeleted: 0,
    conversionJobsFailed: 0,
  };
  if (!isSupabaseConfigured()) return { id: null, startedAt };
  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("cleanup_runs")
      .insert({ status: "running", started_at: startedAt })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id, startedAt };
  } catch (error) {
    console.warn("[conversion-telemetry] cleanup start failed:", error);
    return { id: null, startedAt };
  }
}

export async function finishCleanupRun(
  run: { id: string | null; startedAt: string },
  result: Omit<CleanupStatus, "status" | "startedAt" | "completedAt" | "durationMs"> & {
    status: "completed" | "failed";
  }
): Promise<void> {
  const completedAt = new Date().toISOString();
  const durationMs = Math.max(0, Date.now() - new Date(run.startedAt).getTime());
  const status: CleanupStatus = {
    ...result,
    startedAt: run.startedAt,
    completedAt,
    durationMs,
  };
  localTelemetry().cleanup = status;
  if (!run.id || !isSupabaseConfigured()) return;
  try {
    const supabase = await createServiceClient();
    const { error } = await supabase
      .from("cleanup_runs")
      .update({
        status: result.status,
        files_deleted: result.filesDeleted,
        files_failed: result.filesFailed,
        temp_sessions_deleted: result.tempSessionsDeleted,
        temp_sessions_failed: result.tempSessionsFailed,
        conversion_jobs_deleted: result.conversionJobsDeleted,
        conversion_jobs_failed: result.conversionJobsFailed,
        duration_ms: durationMs,
        error_code: result.errorCode ?? null,
        completed_at: completedAt,
      })
      .eq("id", run.id);
    if (error) console.warn("[conversion-telemetry] cleanup finish failed:", error.message);
  } catch (error) {
    console.warn("[conversion-telemetry] cleanup finish failed:", error);
  }
}

export async function getCleanupOperationalStatus(): Promise<CleanupStatus | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServiceClient();
      const { data, error } = await supabase
        .from("cleanup_runs")
        .select(
          "status, files_deleted, files_failed, temp_sessions_deleted, temp_sessions_failed, conversion_jobs_deleted, conversion_jobs_failed, duration_ms, error_code, started_at, completed_at"
        )
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        status: data.status,
        startedAt: data.started_at,
        completedAt: data.completed_at ?? undefined,
        filesDeleted: data.files_deleted,
        filesFailed: data.files_failed,
        tempSessionsDeleted: data.temp_sessions_deleted,
        tempSessionsFailed: data.temp_sessions_failed,
        conversionJobsDeleted: data.conversion_jobs_deleted,
        conversionJobsFailed: data.conversion_jobs_failed,
        durationMs: data.duration_ms ?? undefined,
        errorCode: data.error_code ?? undefined,
      };
    } catch (error) {
      console.warn("[conversion-telemetry] cleanup read failed:", error);
    }
  }
  return localTelemetry().cleanup ?? null;
}
