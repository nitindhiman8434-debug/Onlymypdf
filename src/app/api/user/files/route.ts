import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getUserJobs, getUserProfile, getUserDailyUsage } from "@/lib/db/queries";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";
import { getCachedAdminSettings } from "@/lib/db/admin-settings-cache";
import { isActivePro } from "@/lib/auth/plan-access";
import {
  getLocalDevDailyUsage,
  getLocalDevJobs,
  getLocalDevTotalProcessed,
  isLocalDevActivityEnabled,
} from "@/lib/auth/local-dev-activity";

type ToolJobRow = {
  id: string;
  tool_name: string;
  status: string;
  created_at: string;
  file_size_bytes: number | null;
  input_files: unknown;
  output_file: unknown;
  completed_at: string | null;
};

type UploadedFileRow = {
  id: string;
  job_id: string | null;
  original_name: string;
  file_size_bytes: number;
  expires_at: string;
  is_deleted: boolean;
};

function formatToolLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function pickFileName(job: ToolJobRow, outputFile?: UploadedFileRow | null): string {
  if (outputFile?.original_name) return outputFile.original_name;

  const output = job.output_file as { name?: string; fileName?: string } | null;
  if (output?.name) return output.name;
  if (output?.fileName) return output.fileName;

  const inputs = job.input_files as Array<{ name?: string; fileName?: string }> | null;
  if (Array.isArray(inputs) && inputs[0]?.name) return inputs[0].name;
  if (Array.isArray(inputs) && inputs[0]?.fileName) return inputs[0].fileName;

  return `${formatToolLabel(job.tool_name)} result`;
}

function mapJobStatus(status: string): "completed" | "processing" | "failed" {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "processing";
}

async function buildLocalDevFilesResponse(userId: string) {
  const settings = await getCachedAdminSettings();
  const filesLimit =
    typeof settings.free_daily_limit === "number"
      ? settings.free_daily_limit
      : Number(settings.free_daily_limit) || 5;
  const aiLimit =
    typeof settings.free_daily_ai_limit === "number"
      ? settings.free_daily_ai_limit
      : Number(settings.free_daily_ai_limit) || 1;

  const jobs = await getLocalDevJobs(userId, 50);
  const now = Date.now();
  const files = jobs.map((job) => {
    const expired = new Date(job.expires_at).getTime() < now;
    return {
      id: job.id,
      file_name: job.file_name,
      tool: formatToolLabel(job.tool_name),
      tool_slug: job.tool_name,
      created_at: job.created_at,
      status: mapJobStatus(job.status),
      file_size: job.file_size_bytes,
      download_url:
        !expired && job.storage_path ? `/api/user/local-files/${job.id}` : null,
      file_id: job.id,
      expired,
    };
  });

  const [filesUsed, aiUsedToday, totalProcessed] = await Promise.all([
    getLocalDevDailyUsage(userId),
    getLocalDevDailyUsage(userId, "ai-pdf-summarizer"),
    getLocalDevTotalProcessed(userId),
  ]);

  return NextResponse.json({
    files,
    usage: {
      files_used: filesUsed,
      files_limit: filesLimit,
      ai_used: aiUsedToday,
      ai_limit: aiLimit,
      total_processed: totalProcessed,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const rateLimited = await guardGeneralApiRateLimit(request);
    if (rateLimited) return rateLimited;

    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    if (isLocalDevActivityEnabled()) {
      return buildLocalDevFilesResponse(user.id);
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        files: [],
        usage: {
          files_used: 0,
          files_limit: 5,
          ai_used: 0,
          ai_limit: 1,
          total_processed: 0,
        },
      });
    }

    const serviceClient = await createServiceClient();
    const jobs = (await getUserJobs(user.id, 50)) as ToolJobRow[];

    const jobIds = jobs.map((j) => j.id);
    let outputFiles: UploadedFileRow[] = [];

    if (jobIds.length > 0) {
      const { data, error } = await serviceClient
        .from("uploaded_files")
        .select("id, job_id, original_name, file_size_bytes, expires_at, is_deleted")
        .eq("user_id", user.id)
        .eq("file_type", "output")
        .eq("is_deleted", false)
        .in("job_id", jobIds);

      if (!error && data) {
        outputFiles = data as UploadedFileRow[];
      }
    }

    const outputByJob = new Map<string, UploadedFileRow>();
    for (const file of outputFiles) {
      if (file.job_id && !outputByJob.has(file.job_id)) {
        outputByJob.set(file.job_id, file);
      }
    }

    const now = Date.now();
    const files = jobs.map((job) => {
      const output = outputByJob.get(job.id) ?? null;
      const expired = output
        ? new Date(output.expires_at).getTime() < now
        : job.status === "completed";

      return {
        id: job.id,
        file_name: pickFileName(job, output),
        tool: formatToolLabel(job.tool_name),
        tool_slug: job.tool_name,
        created_at: job.created_at,
        status: mapJobStatus(job.status),
        file_size: output?.file_size_bytes ?? job.file_size_bytes ?? 0,
        download_url:
          output && !expired && job.status === "completed"
            ? `/api/files/${output.id}`
            : null,
        file_id: output?.id ?? null,
        expired,
      };
    });

    const profile = await getUserProfile(user.id);
    const settings = await getCachedAdminSettings();
    const isPro = isActivePro(profile);
    const filesLimit =
      typeof settings.free_daily_limit === "number"
        ? settings.free_daily_limit
        : Number(settings.free_daily_limit) || 5;
    const aiLimit =
      typeof settings.free_daily_ai_limit === "number"
        ? settings.free_daily_ai_limit
        : Number(settings.free_daily_ai_limit) || 1;
    const [filesUsed, aiUsedToday] = isPro
      ? [0, 0]
      : await Promise.all([
          getUserDailyUsage(user.id),
          getUserDailyUsage(user.id, "ai-pdf-summarizer"),
        ]);

    return NextResponse.json({
      files,
      usage: {
        files_used: filesUsed,
        files_limit: isPro ? -1 : filesLimit,
        ai_used: isPro
          ? ((profile as { ai_credits_used?: number }).ai_credits_used ?? 0)
          : aiUsedToday,
        ai_limit: isPro ? -1 : aiLimit,
        total_processed: (profile as { total_files_processed?: number }).total_files_processed ?? 0,
      },
    });
  } catch (err) {
    console.error("GET /api/user/files:", err);
    return NextResponse.json({
      files: [],
      usage: {
        files_used: 0,
        files_limit: 5,
        ai_used: 0,
        ai_limit: 1,
        total_processed: 0,
      },
    });
  }
}
