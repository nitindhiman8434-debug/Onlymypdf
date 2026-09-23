import { createServiceClient } from "@/lib/supabase/server";

const JOB_TABLE = "conversion_job_records";
const VISIBILITY_TIMEOUT_SECONDS = 15 * 60;

type StoredJobRow<T> = {
  payload: T;
};

type ClaimedQueueRow = {
  msg_id: number | string;
  job_id: string;
  read_count?: number | string;
};

function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

function databaseError(operation: string, error: { message?: string } | null): Error {
  return new Error(`Supabase conversion queue ${operation} failed: ${error?.message ?? "unknown error"}`);
}

export async function readSupabaseConversionJob<T>(jobId: string): Promise<T | undefined> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from(JOB_TABLE)
    .select("payload")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw databaseError("read", error);
  return (data as StoredJobRow<T> | null)?.payload;
}

export async function writeSupabaseConversionJob<T extends { status: string; createdAt: number; startedAt?: number }>(
  jobId: string,
  job: T,
  ttlMs: number
): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from(JOB_TABLE).upsert(
    {
      job_id: jobId,
      payload: job,
      status: job.status,
      started_at: job.startedAt ? new Date(job.startedAt).toISOString() : null,
      expires_at: new Date(job.createdAt + ttlMs).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "job_id" }
  );
  if (error) throw databaseError("write", error);
}

export async function deleteSupabaseConversionJob(jobId: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from(JOB_TABLE).delete().eq("job_id", jobId);
  if (error) throw databaseError("delete job", error);
}

export async function enqueueSupabaseConversionJob(jobId: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.rpc("enqueue_pdf_to_word_job", { p_job_id: jobId });
  if (error) throw databaseError("enqueue", error);
}

export async function claimSupabaseConversionJob(): Promise<{
  jobId: string;
  messageId: string;
  readCount: number;
} | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("claim_pdf_to_word_job", {
    p_visibility_seconds: VISIBILITY_TIMEOUT_SECONDS,
  });
  if (error) throw databaseError("claim", error);
  const row = firstRow(data as ClaimedQueueRow | ClaimedQueueRow[] | null);
  if (!row?.job_id || row.msg_id === undefined || row.msg_id === null) return null;
  return {
    jobId: row.job_id,
    messageId: String(row.msg_id),
    readCount: Number(row.read_count ?? 1),
  };
}

export async function acknowledgeSupabaseConversionMessage(messageId: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.rpc("delete_pdf_to_word_queue_message", {
    p_msg_id: messageId,
  });
  if (error) throw databaseError("acknowledge", error);
}

export async function getSupabaseConversionQueueDepth(): Promise<{
  pending: number;
  processing: number;
}> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("pdf_to_word_queue_depth");
  if (error) throw databaseError("metrics", error);
  const row = firstRow(data as { pending: number | string; processing: number | string } | Array<{
    pending: number | string;
    processing: number | string;
  }> | null);
  return {
    pending: Number(row?.pending ?? 0),
    processing: Number(row?.processing ?? 0),
  };
}

export async function writeSupabaseWorkerHeartbeat<T>(
  heartbeat: T,
  recordedAt: string
): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from("conversion_worker_heartbeat").upsert(
    {
      worker_name: "pdf-to-word",
      payload: heartbeat,
      recorded_at: recordedAt,
    },
    { onConflict: "worker_name" }
  );
  if (error) throw databaseError("heartbeat write", error);
}

export async function readSupabaseWorkerHeartbeat<T>(): Promise<T | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("conversion_worker_heartbeat")
    .select("payload")
    .eq("worker_name", "pdf-to-word")
    .maybeSingle();
  if (error) throw databaseError("heartbeat read", error);
  return (data as { payload: T } | null)?.payload ?? null;
}
