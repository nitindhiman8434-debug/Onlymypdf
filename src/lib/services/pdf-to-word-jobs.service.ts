import fs from "fs/promises";
import os from "os";
import path from "path";
import type { PdfToWordEngine } from "@/lib/services/pdf-to-word.service";
import { mapPdfToWordError } from "@/lib/services/pdf-to-word.service";
import { toSafeApiError } from "@/lib/server/safe-error";
import {
  getUpstashRedis,
  upstashDel,
  upstashGetJson,
  upstashSetJson,
} from "@/lib/server/upstash-kv";
import {
  validateConversionOutput,
  type ConversionOutputValidation,
} from "@/lib/services/conversion-output-validation";
import { isPdfToWordDirectUploadPath } from "@/lib/server/direct-upload-grant";
import {
  deletePdfBlobObjects,
  getPdfBlobObjectInfo,
  isPdfBlobStorageConfigured,
  putPdfBlobObject,
  readPdfBlobObject,
} from "@/lib/server/pdf-blob-storage";
import { getConversionQueueProvider } from "@/lib/services/conversion-queue-provider";
import {
  acknowledgeSupabaseConversionMessage,
  claimSupabaseConversionJob,
  deleteSupabaseConversionJob,
  enqueueSupabaseConversionJob,
  getSupabaseConversionQueueDepth,
  readSupabaseConversionJob,
  writeSupabaseConversionJob,
} from "@/lib/services/supabase-conversion-queue";

export type PdfToWordJobStatus = "queued" | "running" | "done" | "error";

export type PdfToWordJobContext = {
  sourceFileName: string;
  userId: string | null;
  sessionId: string;
  ipAddress: string | null;
  inputBytes: number;
  /** True when the API already opened/decrypted the PDF before staging it. */
  inputPrepared?: boolean;
  /** AES-GCM encrypted; decrypted only inside the isolated worker. */
  encryptedPdfPassword?: string;
};

export type PdfToWordJob = {
  progress: number;
  status: PdfToWordJobStatus;
  filename: string;
  ownerKey: string;
  engine?: PdfToWordEngine;
  attemptedEngines?: PdfToWordEngine[];
  attemptCount?: number;
  outputValidation?: ConversionOutputValidation;
  /** Local DOCX path (same instance only) */
  outputPath?: string;
  /** Private object-storage path (multi-instance safe) */
  storagePath?: string;
  /** Private staged input for a worker on another instance. */
  inputStoragePath?: string;
  context?: PdfToWordJobContext;
  workDir?: string;
  error?: string;
  createdAt: number;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
  queueTimeMs?: number;
  processingTimeMs?: number;
  /** Supabase PGMQ receipt used to acknowledge a completed queue message. */
  queueMessageId?: string;
};

const JOB_TTL_MS = 2 * 60 * 60 * 1000;
const JOB_TTL_SEC = Math.ceil(JOB_TTL_MS / 1000);
const WORKER_LEASE_MS = 15 * 60 * 1000;
const RECOVERY_INTERVAL_MS = 60 * 1000;
const REDIS_PREFIX = "pdf-to-word:job:";
const REDIS_PENDING_QUEUE = "pdf-to-word:queue:pending";
const REDIS_PROCESSING_QUEUE = "pdf-to-word:queue:processing";
let lastRecoveryAt = 0;

type JobStore = Map<string, PdfToWordJob>;

function memoryStore(): JobStore {
  const globalStore = globalThis as typeof globalThis & { __pdfToWordJobs?: JobStore };
  if (!globalStore.__pdfToWordJobs) {
    globalStore.__pdfToWordJobs = new Map();
  }
  return globalStore.__pdfToWordJobs;
}

function localQueue(): { pending: string[]; processing: Set<string> } {
  const root = globalThis as typeof globalThis & {
    __pdfToWordQueue?: { pending: string[]; processing: Set<string> };
  };
  if (!root.__pdfToWordQueue) {
    root.__pdfToWordQueue = { pending: [], processing: new Set() };
  }
  return root.__pdfToWordQueue;
}

function redisKey(jobId: string): string {
  return `${REDIS_PREFIX}${jobId}`;
}

async function readJob(jobId: string): Promise<PdfToWordJob | undefined> {
  const provider = getConversionQueueProvider();
  if (provider === "supabase") {
    const remote = await readSupabaseConversionJob<PdfToWordJob>(jobId);
    if (remote) memoryStore().set(jobId, remote);
    return remote;
  }
  if (provider === "upstash") {
    const remote = await upstashGetJson<PdfToWordJob>(redisKey(jobId));
    if (remote) return remote;
  }
  return memoryStore().get(jobId);
}

async function writeJob(jobId: string, job: PdfToWordJob): Promise<void> {
  memoryStore().set(jobId, job);
  const provider = getConversionQueueProvider();
  if (provider === "supabase") {
    await writeSupabaseConversionJob(jobId, job, JOB_TTL_MS);
  } else if (provider === "upstash") {
    await upstashSetJson(redisKey(jobId), job, JOB_TTL_SEC);
  } else if (provider === "unavailable") {
    throw new Error("Configured conversion queue provider is unavailable.");
  }
}

async function deleteJobRecord(jobId: string): Promise<void> {
  memoryStore().delete(jobId);
  const provider = getConversionQueueProvider();
  if (provider === "supabase") {
    await deleteSupabaseConversionJob(jobId);
  } else if (provider === "upstash") {
    await upstashDel(redisKey(jobId));
  }
}

async function cleanupJobFiles(job: PdfToWordJob) {
  const storagePaths = [job.storagePath, job.inputStoragePath].filter(
    (value): value is string => Boolean(value)
  );
  if (storagePaths.length > 0) {
    try {
      await deletePdfBlobObjects(storagePaths);
    } catch {
      // best effort
    }
  }
  if (job.workDir) {
    await fs.rm(job.workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function purgeExpiredJobs() {
  const store = memoryStore();
  const now = Date.now();
  for (const [id, job] of store.entries()) {
    if (now - job.createdAt > JOB_TTL_MS) {
      await cleanupJobFiles(job);
      store.delete(id);
    }
  }
}

async function uploadOutputToStorage(jobId: string, localPath: string): Promise<string> {
  const buffer = await fs.readFile(localPath);
  const storagePath = `temp-jobs/pdf-to-word/${jobId}.docx`;
  await putPdfBlobObject(
    storagePath,
    buffer,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  return storagePath;
}

export async function createPdfToWordJob(
  filename: string,
  ownerKey: string,
  context?: PdfToWordJobContext
): Promise<string> {
  await purgeExpiredJobs();
  const id = crypto.randomUUID();
  const job: PdfToWordJob = {
    progress: 0,
    status: "queued",
    filename,
    ownerKey,
    context,
    createdAt: Date.now(),
    queuedAt: Date.now(),
  };
  await writeJob(id, job);
  return id;
}

export async function stagePdfToWordJobInput(jobId: string, input: Buffer): Promise<void> {
  const job = await readJob(jobId);
  if (!job || job.status !== "queued") throw new Error("Queued job was not found.");

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdfdoctor-ptw-job-"));
  const inputPath = path.join(workDir, "input.pdf");
  await fs.writeFile(inputPath, input);
  job.workDir = workDir;
  job.outputPath = path.join(workDir, "output.docx");

  if (isPdfBlobStorageConfigured()) {
    const storagePath = `temp-jobs/pdf-to-word/${jobId}/input.pdf`;
    await putPdfBlobObject(storagePath, input, "application/pdf");
    job.inputStoragePath = storagePath;
  }
  await writeJob(jobId, job);
}

/** Attach a browser-direct private storage upload without proxying its bytes through the app. */
export async function stagePdfToWordJobInputFromStorage(
  jobId: string,
  storagePath: string,
  expectedBytes: number
): Promise<void> {
  const job = await readJob(jobId);
  if (!job || job.status !== "queued") throw new Error("Queued job was not found.");
  if (!isPdfToWordDirectUploadPath(storagePath)) {
    throw new Error("Direct upload path is invalid.");
  }

  try {
    const info = await getPdfBlobObjectInfo(storagePath);
    if (!Number.isSafeInteger(info.size) || info.size !== expectedBytes) {
      throw new Error("Uploaded file size does not match the signed request.");
    }
    if (info.contentType && info.contentType !== "application/pdf") {
      throw new Error("Uploaded file content type is not PDF.");
    }
    job.inputStoragePath = storagePath;
    await writeJob(jobId, job);
  } catch (error) {
    await deletePdfBlobObjects([storagePath]).catch(() => undefined);
    throw error;
  }
}

export async function enqueuePdfToWordJob(jobId: string): Promise<void> {
  const job = await readJob(jobId);
  if (!job || job.status !== "queued") throw new Error("Queued job was not found.");
  const provider = getConversionQueueProvider();
  if (provider === "supabase") {
    await enqueueSupabaseConversionJob(jobId);
    return;
  }
  if (provider === "upstash") {
    const redis = await getUpstashRedis();
    if (!redis) throw new Error("Conversion queue is unavailable.");
    await redis.rpush(REDIS_PENDING_QUEUE, jobId);
    return;
  }
  if (provider === "unavailable") {
    throw new Error("Configured conversion queue provider is unavailable.");
  }
  const queue = localQueue();
  if (!queue.pending.includes(jobId) && !queue.processing.has(jobId)) {
    queue.pending.push(jobId);
  }
}

async function removeProcessingJob(jobId: string): Promise<void> {
  const provider = getConversionQueueProvider();
  if (provider === "supabase") {
    const job = await readJob(jobId);
    if (job?.queueMessageId) {
      await acknowledgeSupabaseConversionMessage(job.queueMessageId);
    }
  } else if (provider === "upstash") {
    const redis = await getUpstashRedis();
    if (redis) await redis.lrem(REDIS_PROCESSING_QUEUE, 1, jobId);
  } else {
    localQueue().processing.delete(jobId);
  }
}

export async function recoverStalePdfToWordJobs(): Promise<number> {
  const provider = getConversionQueueProvider();
  // PGMQ makes an unacknowledged message visible again when its lease expires.
  if (provider === "supabase") return 0;
  let ids: string[] = [];
  if (provider === "upstash") {
    const redis = await getUpstashRedis();
    if (!redis) return 0;
    ids = await redis.lrange<string>(REDIS_PROCESSING_QUEUE, 0, -1);
  } else {
    ids = [...localQueue().processing];
  }

  let recovered = 0;
  for (const id of ids) {
    const job = await readJob(id);
    if (!job || job.status === "done" || job.status === "error") {
      await removeProcessingJob(id);
      continue;
    }
    if (job.status === "running" && job.startedAt && Date.now() - job.startedAt > WORKER_LEASE_MS) {
      job.status = "queued";
      job.startedAt = undefined;
      job.queueTimeMs = undefined;
      await writeJob(id, job);
      await removeProcessingJob(id);
      await enqueuePdfToWordJob(id);
      recovered += 1;
    }
  }
  return recovered;
}

export async function claimNextPdfToWordJob(): Promise<{ id: string; job: PdfToWordJob } | null> {
  const provider = getConversionQueueProvider();
  if (provider === "unavailable") {
    throw new Error("Configured conversion queue provider is unavailable.");
  }
  if (provider !== "supabase" && Date.now() - lastRecoveryAt >= RECOVERY_INTERVAL_MS) {
    await recoverStalePdfToWordJobs();
    lastRecoveryAt = Date.now();
  }
  let id: string | null | undefined;
  let queueMessageId: string | undefined;
  if (provider === "supabase") {
    const claimed = await claimSupabaseConversionJob();
    id = claimed?.jobId;
    queueMessageId = claimed?.messageId;
  } else if (provider === "upstash") {
    const redis = await getUpstashRedis();
    if (!redis) return null;
    id = (await redis.lmove<string>(
      REDIS_PENDING_QUEUE,
      REDIS_PROCESSING_QUEUE,
      "left",
      "right"
    )) as string | null;
  } else {
    const queue = localQueue();
    id = queue.pending.shift();
    if (id) queue.processing.add(id);
  }
  if (!id) return null;

  const job = await readJob(id);
  if (!job) {
    if (queueMessageId) await acknowledgeSupabaseConversionMessage(queueMessageId);
    else await removeProcessingJob(id);
    return null;
  }
  if (
    provider === "supabase" &&
    job.status === "running" &&
    job.startedAt &&
    Date.now() - job.startedAt >= WORKER_LEASE_MS
  ) {
    job.status = "queued";
    job.startedAt = undefined;
    job.queueTimeMs = undefined;
  }
  if (job.status !== "queued") {
    if (queueMessageId && (job.status === "done" || job.status === "error")) {
      await acknowledgeSupabaseConversionMessage(queueMessageId);
    } else if (!queueMessageId) {
      await removeProcessingJob(id);
    }
    return null;
  }
  if (queueMessageId) job.queueMessageId = queueMessageId;
  job.status = "running";
  job.startedAt = Date.now();
  job.queueTimeMs = Math.max(0, job.startedAt - job.queuedAt);
  job.progress = Math.max(1, job.progress);
  await writeJob(id, job);
  return { id, job };
}

export async function notePdfToWordEngineAttempt(
  jobId: string,
  engine: PdfToWordEngine,
  attempt: number
): Promise<void> {
  const job = await readJob(jobId);
  if (!job || job.status !== "running") return;
  const attempted = job.attemptedEngines ?? [];
  if (!attempted.includes(engine)) attempted.push(engine);
  job.attemptedEngines = attempted;
  job.attemptCount = Math.max(job.attemptCount ?? 0, attempt);
  await writeJob(jobId, job);
}

export async function materializePdfToWordJobInput(jobId: string): Promise<{
  job: PdfToWordJob;
  inputPath: string;
  outputPath: string;
  workDir: string;
}> {
  const job = await readJob(jobId);
  if (!job || job.status !== "running") throw new Error("Running job was not found.");

  let input: Buffer | null = null;
  if (job.workDir) {
    try {
      input = await fs.readFile(path.join(job.workDir, "input.pdf"));
    } catch {
      input = null;
    }
  }
  if (!input && job.inputStoragePath) {
    input = await readPdfBlobObject(job.inputStoragePath);
  }
  if (!input?.length) throw new Error("Staged PDF input is unavailable.");

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdfdoctor-ptw-worker-"));
  const inputPath = path.join(workDir, "input.pdf");
  const outputPath = path.join(workDir, "output.docx");
  await fs.writeFile(inputPath, input);
  if (job.workDir && job.workDir !== workDir) {
    await fs.rm(job.workDir, { recursive: true, force: true }).catch(() => {});
  }
  job.workDir = workDir;
  job.outputPath = outputPath;
  await writeJob(jobId, job);
  return { job, inputPath, outputPath, workDir };
}

export async function updatePdfToWordJobProgress(jobId: string, progress: number) {
  const job = await readJob(jobId);
  if (!job || job.status !== "running") return;
  job.progress = Math.max(job.progress, Math.min(99, progress));
  await writeJob(jobId, job);
}

export async function completePdfToWordJob(
  jobId: string,
  payload: { outputPath: string; workDir: string; engine: PdfToWordEngine }
) {
  const job = await readJob(jobId);
  if (!job) return;

  // Guard: never mark a job "done" pointing at a missing/empty file. This turns
  // a silent engine miss into a clean error instead of an ENOENT at download.
  try {
    const stat = await fs.stat(payload.outputPath);
    if (!stat.isFile() || stat.size === 0) {
      throw new Error("Conversion produced no output file.");
    }
  } catch {
    throw new Error(
      "Conversion did not produce a Word file. Please try again or use a different PDF."
    );
  }

  const output = await fs.readFile(payload.outputPath);
  const validation = await validateConversionOutput(output, "docx");
  if (!validation.valid) {
    throw new Error(`Conversion output validation failed: ${validation.errors.join(" ")}`);
  }

  job.status = "done";
  job.progress = 99;
  job.outputPath = payload.outputPath;
  job.workDir = payload.workDir;
  job.engine = payload.engine;
  job.outputValidation = validation;
  job.completedAt = Date.now();
  job.processingTimeMs = job.startedAt ? Math.max(0, job.completedAt - job.startedAt) : undefined;
  if (job.context) delete job.context.encryptedPdfPassword;

  if (isPdfBlobStorageConfigured()) {
    try {
      job.storagePath = await uploadOutputToStorage(jobId, payload.outputPath);
    } catch (err) {
      if (process.env.NODE_ENV === "production" || getConversionQueueProvider() !== "memory") {
        throw new Error("Conversion output could not be persisted to private storage.", {
          cause: err,
        });
      }
      console.warn("[pdf-to-word-jobs] Storage upload failed, local path only:", err);
    }
  }

  job.progress = 100;
  await writeJob(jobId, job);
  await removeProcessingJob(jobId);
}

export async function failPdfToWordJob(jobId: string, error: unknown, workDir?: string) {
  const job = await readJob(jobId);
  if (!job) return;
  const raw = error instanceof Error ? error.message : String(error);
  const mapped = mapPdfToWordError(raw);
  job.status = "error";
  job.error = toSafeApiError(new Error(mapped), "Conversion failed. Please try again.");
  if (job.context) delete job.context.encryptedPdfPassword;
  if (workDir) job.workDir = workDir;
  await cleanupJobFiles(job);
  job.completedAt = Date.now();
  job.processingTimeMs = job.startedAt ? Math.max(0, job.completedAt - job.startedAt) : undefined;
  await writeJob(jobId, job);
  await removeProcessingJob(jobId);
}

export async function getPdfToWordQueueDepth(): Promise<{
  pending: number;
  processing: number;
}> {
  const provider = getConversionQueueProvider();
  if (provider === "supabase") {
    return getSupabaseConversionQueueDepth();
  }
  if (provider === "upstash") {
    const redis = await getUpstashRedis();
    if (!redis) return { pending: 0, processing: 0 };
    const [pending, processing] = await Promise.all([
      redis.llen(REDIS_PENDING_QUEUE),
      redis.llen(REDIS_PROCESSING_QUEUE),
    ]);
    return { pending, processing };
  }
  if (provider === "unavailable") {
    throw new Error("Configured conversion queue provider is unavailable.");
  }
  const queue = localQueue();
  return { pending: queue.pending.length, processing: queue.processing.size };
}

export async function getPdfToWordJob(jobId: string): Promise<PdfToWordJob | undefined> {
  void purgeExpiredJobs();
  return readJob(jobId);
}

export async function consumePdfToWordJob(jobId: string): Promise<PdfToWordJob | undefined> {
  const job = await getPdfToWordJob(jobId);
  if (!job || job.status !== "done" || (!job.outputPath && !job.storagePath)) {
    return undefined;
  }
  await deleteJobRecord(jobId);
  return job;
}

export async function releasePdfToWordJob(job: PdfToWordJob) {
  await cleanupJobFiles(job);
}

export async function readPdfToWordJobOutput(job: PdfToWordJob): Promise<Buffer> {
  if (job.storagePath) {
    return readPdfBlobObject(job.storagePath);
  }
  if (job.outputPath) {
    return fs.readFile(job.outputPath);
  }
  throw new Error("No output available for this job");
}
