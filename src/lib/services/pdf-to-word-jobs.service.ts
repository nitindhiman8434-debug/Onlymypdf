import fs from "fs/promises";
import type { PdfToWordEngine } from "@/lib/services/pdf-to-word.service";
import { mapPdfToWordError } from "@/lib/services/pdf-to-word.service";
import { toSafeApiError } from "@/lib/server/safe-error";
import { createServiceClient } from "@/lib/supabase/server";
import {
  isUpstashConfigured,
  upstashDel,
  upstashGetJson,
  upstashSetJson,
} from "@/lib/server/upstash-kv";

export type PdfToWordJobStatus = "running" | "done" | "error";

export type PdfToWordJob = {
  progress: number;
  status: PdfToWordJobStatus;
  filename: string;
  ownerKey: string;
  engine?: PdfToWordEngine;
  /** Local DOCX path (same instance only) */
  outputPath?: string;
  /** Supabase storage path (multi-instance safe) */
  storagePath?: string;
  workDir?: string;
  error?: string;
  createdAt: number;
};

const JOB_TTL_MS = 20 * 60 * 1000;
const JOB_TTL_SEC = Math.ceil(JOB_TTL_MS / 1000);
const STORAGE_BUCKET = "pdf-files";
const REDIS_PREFIX = "pdf-to-word:job:";

type JobStore = Map<string, PdfToWordJob>;

function memoryStore(): JobStore {
  const globalStore = globalThis as typeof globalThis & { __pdfToWordJobs?: JobStore };
  if (!globalStore.__pdfToWordJobs) {
    globalStore.__pdfToWordJobs = new Map();
  }
  return globalStore.__pdfToWordJobs;
}

function redisKey(jobId: string): string {
  return `${REDIS_PREFIX}${jobId}`;
}

async function readJob(jobId: string): Promise<PdfToWordJob | undefined> {
  if (isUpstashConfigured()) {
    const remote = await upstashGetJson<PdfToWordJob>(redisKey(jobId));
    if (remote) return remote;
  }
  return memoryStore().get(jobId);
}

async function writeJob(jobId: string, job: PdfToWordJob): Promise<void> {
  memoryStore().set(jobId, job);
  if (isUpstashConfigured()) {
    await upstashSetJson(redisKey(jobId), job, JOB_TTL_SEC);
  }
}

async function deleteJobRecord(jobId: string): Promise<void> {
  memoryStore().delete(jobId);
  if (isUpstashConfigured()) {
    await upstashDel(redisKey(jobId));
  }
}

async function cleanupJobFiles(job: PdfToWordJob) {
  if (job.storagePath) {
    try {
      const supabase = await createServiceClient();
      await supabase.storage.from(STORAGE_BUCKET).remove([job.storagePath]);
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
  const supabase = await createServiceClient();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, {
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: true,
  });
  if (error) throw error;
  return storagePath;
}

export async function createPdfToWordJob(filename: string, ownerKey: string): Promise<string> {
  await purgeExpiredJobs();
  const id = crypto.randomUUID();
  const job: PdfToWordJob = {
    progress: 0,
    status: "running",
    filename,
    ownerKey,
    createdAt: Date.now(),
  };
  await writeJob(id, job);
  return id;
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

  job.status = "done";
  job.progress = 99;
  job.outputPath = payload.outputPath;
  job.workDir = payload.workDir;
  job.engine = payload.engine;

  try {
    job.storagePath = await uploadOutputToStorage(jobId, payload.outputPath);
  } catch (err) {
    console.warn("[pdf-to-word-jobs] Storage upload failed, local path only:", err);
  }

  job.progress = 100;
  await writeJob(jobId, job);
}

export async function failPdfToWordJob(jobId: string, error: unknown, workDir?: string) {
  const job = await readJob(jobId);
  if (!job) return;
  const raw = error instanceof Error ? error.message : String(error);
  const mapped = mapPdfToWordError(raw);
  job.status = "error";
  job.error = toSafeApiError(new Error(mapped), "Conversion failed. Please try again.");
  if (workDir) {
    job.workDir = workDir;
    await cleanupJobFiles(job);
  }
  await writeJob(jobId, job);
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
    const supabase = await createServiceClient();
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(job.storagePath);
    if (error || !data) throw error ?? new Error("Output file not found in storage");
    return Buffer.from(await data.arrayBuffer());
  }
  if (job.outputPath) {
    return fs.readFile(job.outputPath);
  }
  throw new Error("No output available for this job");
}
