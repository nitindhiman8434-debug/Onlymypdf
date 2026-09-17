import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { invalidateAdminSettingsCache } from "@/lib/db/admin-settings-cache";

const DEFAULT_ADMIN_SETTINGS: Record<string, unknown> = {
  free_daily_limit: 5,
  free_daily_ai_limit: 1,
};

// ---------------------------------------------------------------------------
// User Profiles
// ---------------------------------------------------------------------------

export async function getUserProfile(userId: string) {
  if (!isSupabaseConfigured()) {
    const { getLocalDevTotalProcessed, isLocalDevActivityEnabled } = await import(
      "@/lib/auth/local-dev-activity"
    );
    const total_files_processed =
      isLocalDevActivityEnabled() ? await getLocalDevTotalProcessed(userId) : 0;
    return { id: userId, plan: "free" as const, total_files_processed };
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserProfile(
  userId: string,
  data: Record<string, unknown>
) {
  const supabase = await createServiceClient();
  const { data: updated, error } = await supabase
    .from("user_profiles")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

// ---------------------------------------------------------------------------
// Tool Jobs
// ---------------------------------------------------------------------------

export async function createToolJob(data: {
  user_id?: string | null;
  guest_session_id?: string | null;
  tool_name: string;
  input_files?: unknown[];
  options?: Record<string, unknown>;
  file_size_bytes?: number;
}) {
  const supabase = await createServiceClient();
  const { data: job, error } = await supabase
    .from("tool_jobs")
    .insert({
      user_id: data.user_id ?? null,
      guest_session_id: data.guest_session_id ?? null,
      tool_name: data.tool_name,
      status: "pending",
      input_files: data.input_files ?? [],
      options: data.options ?? {},
      file_size_bytes: data.file_size_bytes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return job;
}

export async function updateToolJob(
  jobId: string,
  data: Record<string, unknown>
) {
  const supabase = await createServiceClient();
  const { data: updated, error } = await supabase
    .from("tool_jobs")
    .update(data)
    .eq("id", jobId)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

export async function getToolJob(jobId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("tool_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) throw error;
  return data;
}

export async function getUserJobs(userId: string, limit = 20) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("tool_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Uploaded Files
// ---------------------------------------------------------------------------

export async function createUploadedFile(data: {
  user_id?: string | null;
  guest_session_id?: string | null;
  job_id?: string | null;
  original_name: string;
  stored_name: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  file_type?: "input" | "output";
  expires_at?: string;
}) {
  const supabase = await createServiceClient();

  let expiresAt = data.expires_at;
  if (!expiresAt && data.user_id) {
    const { computeFileExpiresAt, fileRetentionHoursForPlan } = await import(
      "@/lib/privacy/retention"
    );
    try {
      const profile = await getUserProfile(data.user_id);
      const hours = fileRetentionHoursForPlan(
        (profile as { plan?: string }).plan ?? "free"
      );
      expiresAt = computeFileExpiresAt(hours);
    } catch {
      const { computeFileExpiresAt, fileRetentionHoursForPlan } = await import(
        "@/lib/privacy/retention"
      );
      expiresAt = computeFileExpiresAt(fileRetentionHoursForPlan("free"));
    }
  }

  const row: Record<string, unknown> = {
    user_id: data.user_id ?? null,
    guest_session_id: data.guest_session_id ?? null,
    job_id: data.job_id ?? null,
    original_name: data.original_name,
    stored_name: data.stored_name,
    storage_path: data.storage_path,
    mime_type: data.mime_type,
    file_size_bytes: data.file_size_bytes,
    file_type: data.file_type ?? "input",
  };
  if (expiresAt) row.expires_at = expiresAt;

  const { data: file, error } = await supabase
    .from("uploaded_files")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return file;
}

export async function getUploadedFile(fileId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("uploaded_files")
    .select("*")
    .eq("id", fileId)
    .single();

  if (error) throw error;
  return data;
}

export async function markFileDeleted(fileId: string) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("uploaded_files")
    .update({
      is_deleted: true,
      original_name: "deleted",
      stored_name: "deleted",
    })
    .eq("id", fileId);

  if (error) throw error;
}

export async function getExpiredFiles(limit = 200) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("uploaded_files")
    .select("*")
    .eq("is_deleted", false)
    .lt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Usage Logs
// ---------------------------------------------------------------------------

export async function logUsage(data: {
  user_id?: string | null;
  guest_ip_hash?: string | null;
  tool_name: string;
  file_size_bytes?: number | null;
  processing_time_ms?: number | null;
  status: "success" | "failed";
}) {
  if (!isSupabaseConfigured()) {
    if (data.user_id) {
      const { recordLocalDevUsage, isLocalDevActivityEnabled } = await import(
        "@/lib/auth/local-dev-activity"
      );
      if (isLocalDevActivityEnabled()) {
        await recordLocalDevUsage({
          userId: data.user_id,
          toolName: data.tool_name,
          status: data.status,
        });
      }
    }
    return;
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.from("usage_logs").insert({
    user_id: data.user_id ?? null,
    guest_ip_hash: data.guest_ip_hash ?? null,
    tool_name: data.tool_name,
    file_size_bytes: data.file_size_bytes ?? null,
    processing_time_ms: data.processing_time_ms ?? null,
    status: data.status,
  });

  if (error) throw error;
}

export async function logAIUsage(data: {
  user_id: string;
  tool_name?: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  estimated_cost?: number | null;
  provider?: string;
  model?: string | null;
  status: "success" | "failed";
}) {
  const supabase = await createServiceClient();
  const { error } = await supabase.from("ai_usage_logs").insert({
    user_id: data.user_id,
    tool_name: data.tool_name ?? "ai-pdf-summarizer",
    input_tokens: data.input_tokens ?? null,
    output_tokens: data.output_tokens ?? null,
    estimated_cost: data.estimated_cost ?? null,
    provider: data.provider ?? "gemini",
    model: data.model ?? null,
    status: data.status,
  });

  if (error) throw error;
}

export async function getUserDailyUsage(userId: string, toolName?: string) {
  if (!isSupabaseConfigured()) {
    const { getLocalDevDailyUsage, isLocalDevActivityEnabled } = await import(
      "@/lib/auth/local-dev-activity"
    );
    if (isLocalDevActivityEnabled()) {
      return getLocalDevDailyUsage(userId, toolName);
    }
    return 0;
  }

  const supabase = await createServiceClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let query = supabase
    .from("usage_logs")
    .select("id", { count: "exact" })
    .eq("user_id", userId)
    .eq("status", "success")
    .gte("created_at", todayStart.toISOString());

  if (toolName) {
    query = query.eq("tool_name", toolName);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getGuestDailyUsage(ipHash: string) {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createServiceClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("usage_logs")
    .select("id", { count: "exact" })
    .eq("guest_ip_hash", ipHash)
    .eq("status", "success")
    .gte("created_at", todayStart.toISOString());

  if (error) throw error;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Admin Settings
// ---------------------------------------------------------------------------

export async function getAdminSettings() {
  if (!isSupabaseConfigured()) {
    return { ...DEFAULT_ADMIN_SETTINGS };
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase.from("admin_settings").select("*");

  if (error) throw error;

  const settings: Record<string, unknown> = {};
  for (const row of data ?? []) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function updateAdminSetting(key: string, value: unknown) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("admin_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) throw error;
  invalidateAdminSettingsCache();
}

export async function listRecentErrorLogs(limit = 50) {
  const supabase = await createServiceClient();
  const capped = Math.min(Math.max(limit, 1), 200);
  const { data, error } = await supabase
    .from("error_logs")
    .select("id, error_type, error_message, tool_name, user_id, stack_trace, created_at")
    .order("created_at", { ascending: false })
    .limit(capped);

  if (error) throw error;
  return data ?? [];
}

export async function downgradeExpiredProProfiles(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  const { data: expiredProfiles, error } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("plan", "pro")
    .not("plan_expires_at", "is", null)
    .lt("plan_expires_at", now);

  if (error) throw error;
  if (!expiredProfiles?.length) return 0;

  const ids = expiredProfiles.map((p) => p.id);

  await supabase
    .from("user_profiles")
    .update({ plan: "free", updated_at: now })
    .in("id", ids);

  await supabase
    .from("subscriptions")
    .update({ status: "expired", updated_at: now })
    .in("user_id", ids)
    .eq("status", "active");

  return ids.length;
}

export async function getAdminDashboardStats() {
  const supabase = await createServiceClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  const [
    { count: totalUsers },
    { count: totalJobs },
    { count: todayJobs },
    { count: totalPayments },
    { data: revenueData },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true }),
    supabase.from("tool_jobs").select("id", { count: "exact", head: true }),
    supabase
      .from("tool_jobs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayISO),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "completed"),
  ]);

  const totalRevenue =
    revenueData?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  return {
    totalUsers: totalUsers ?? 0,
    totalJobs: totalJobs ?? 0,
    todayJobs: todayJobs ?? 0,
    totalPayments: totalPayments ?? 0,
    totalRevenue,
  };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function createPayment(data: {
  user_id: string;
  subscription_id?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_signature?: string | null;
  razorpay_subscription_id?: string | null;
  billing_mode?: "one_time" | "subscription" | null;
  amount: number;
  currency?: string;
  status?: "pending" | "completed" | "failed" | "refunded" | "processing";
  payment_method?: string | null;
  plan_name?: string | null;
  plan_duration?: string | null;
  coupon_code?: string | null;
}) {
  const supabase = await createServiceClient();
  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      user_id: data.user_id,
      subscription_id: data.subscription_id ?? null,
      razorpay_order_id: data.razorpay_order_id ?? null,
      razorpay_payment_id: data.razorpay_payment_id ?? null,
      razorpay_signature: data.razorpay_signature ?? null,
      razorpay_subscription_id: data.razorpay_subscription_id ?? null,
      billing_mode: data.billing_mode ?? "one_time",
      amount: data.amount,
      currency: data.currency ?? "INR",
      status: data.status ?? "pending",
      payment_method: data.payment_method ?? null,
      plan_name: data.plan_name ?? null,
      plan_duration: data.plan_duration ?? null,
      coupon_code: data.coupon_code ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return payment;
}

export async function getPaymentByRazorpayOrderId(orderId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("razorpay_order_id", orderId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getPaymentByRazorpayPaymentId(paymentId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("razorpay_payment_id", paymentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getPlanUuidByName(planName: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id")
    .eq("name", planName)
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function incrementCouponUsage(code: string): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("increment_coupon_usage", {
    p_code: code,
  });

  if (error) {
    // Fail closed: the racy read-then-update fallback could exceed max_uses.
    return false;
  }

  return Boolean(data);
}

/** Roll back a coupon increment when fulfillment fails after redemption. */
export async function decrementCouponUsage(code: string): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("decrement_coupon_usage", {
    p_code: code,
  });

  if (error) {
    const { data: coupon } = await supabase
      .from("coupon_codes")
      .select("times_used")
      .eq("code", code.toUpperCase())
      .single();
    if (!coupon) return false;
    const { error: updateError } = await supabase
      .from("coupon_codes")
      .update({ times_used: Math.max((coupon.times_used ?? 0) - 1, 0) })
      .eq("code", code.toUpperCase());
    return !updateError;
  }

  return Boolean(data);
}

/** Reset payments stuck in processing (e.g. after a crash mid-fulfillment). */
export async function releaseStaleProcessingPayments(maxAgeMinutes = 15): Promise<number> {
  const supabase = await createServiceClient();
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("payments")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("status", "processing")
    .lt("updated_at", cutoff)
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}

export async function updatePayment(
  paymentId: string,
  data: Record<string, unknown>
) {
  const supabase = await createServiceClient();
  const { data: updated, error } = await supabase
    .from("payments")
    .update(data)
    .eq("id", paymentId)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

/** Atomically claim a pending payment for fulfillment (prevents duplicate subscriptions). */
export async function claimPaymentForFulfillment(paymentId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("payments")
    .update({ status: "processing" })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function finalizeClaimedPayment(
  paymentId: string,
  data: Record<string, unknown>
) {
  const supabase = await createServiceClient();
  const { data: updated, error } = await supabase
    .from("payments")
    .update({ ...data, status: "completed" })
    .eq("id", paymentId)
    .eq("status", "processing")
    .select()
    .maybeSingle();

  if (error) throw error;
  return updated;
}

export async function releasePaymentClaim(paymentId: string) {
  const supabase = await createServiceClient();
  await supabase
    .from("payments")
    .update({ status: "pending" })
    .eq("id", paymentId)
    .eq("status", "processing");
}

/** Mark a payment's coupon as redeemed (bounds the double-increment window). */
export async function markCouponRedeemed(paymentId: string) {
  const supabase = await createServiceClient();
  await supabase
    .from("payments")
    .update({ coupon_redeemed_at: new Date().toISOString() })
    .eq("id", paymentId)
    .is("coupon_redeemed_at", null);
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export async function getUserSubscription(userId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plans(*)")
    .eq("user_id", userId)
    .in("status", ["active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createSubscription(data: {
  user_id: string;
  plan_id: string;
  status?: string;
  razorpay_subscription_id?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  last_fulfilled_payment_id?: string | null;
}) {
  const supabase = await createServiceClient();
  const { data: sub, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: data.user_id,
      plan_id: data.plan_id,
      status: data.status ?? "active",
      razorpay_subscription_id: data.razorpay_subscription_id ?? null,
      current_period_start: data.current_period_start ?? new Date().toISOString(),
      current_period_end: data.current_period_end ?? null,
      ...(data.last_fulfilled_payment_id
        ? { last_fulfilled_payment_id: data.last_fulfilled_payment_id }
        : {}),
    })
    .select()
    .single();

  if (error) throw error;
  return sub;
}

export async function updateSubscription(
  subId: string,
  data: Record<string, unknown>
) {
  const supabase = await createServiceClient();
  const { data: updated, error } = await supabase
    .from("subscriptions")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", subId)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

// ---------------------------------------------------------------------------
// Coupon Codes
// ---------------------------------------------------------------------------

export async function getCouponCode(code: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("coupon_codes")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;

  const now = new Date();
  if (data.valid_until && new Date(data.valid_until) < now) return null;
  if (data.max_uses !== -1 && data.times_used >= data.max_uses) return null;

  return data;
}

// ---------------------------------------------------------------------------
// Error Logging
// ---------------------------------------------------------------------------

// Aliases for backward compatibility with API routes
export const logToolUsage = async (data: {
  userId?: string | null;
  sessionId?: string | null;
  toolSlug?: string;
  ipAddress?: string | null;
  fileSize?: number;
  processingTimeMs?: number;
  status?: string;
  inputFileNames?: string[];
  conversionMetricRecorded?: boolean;
  output?: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  };
}) => {
  const toolSlug = data.toolSlug ?? "unknown";
  const succeeded =
    data.status !== "failed" &&
    (data.status === "completed" || data.status === "success" || !data.status);

  await logUsage({
    user_id: data.userId ?? null,
    guest_ip_hash: data.userId ? null : (data.ipAddress ?? null),
    tool_name: toolSlug,
    file_size_bytes: data.fileSize ?? null,
    processing_time_ms: data.processingTimeMs ?? null,
    status: succeeded ? "success" : "failed",
  });

  if (succeeded && data.output && !data.conversionMetricRecorded) {
    const extension = data.output.fileName.split(".").pop()?.toLowerCase();
    const kind =
      extension && ["pdf", "docx", "xlsx", "pptx", "txt", "html"].includes(extension)
        ? extension
        : data.output.mimeType.startsWith("image/")
          ? "image"
          : null;
    if (kind) {
      const [{ validateConversionOutput }, { recordConversionMetric }] = await Promise.all([
        import("@/lib/services/conversion-output-validation"),
        import("@/lib/ops/conversion-telemetry"),
      ]);
      const validation = await validateConversionOutput(
        data.output.buffer,
        kind as import("@/lib/services/conversion-output-validation").ConversionOutputKind
      );
      await recordConversionMetric({
        toolName: toolSlug,
        status: validation.valid ? "completed" : "failed",
        inputBytes: data.fileSize,
        outputBytes: data.output.buffer.length,
        processingTimeMs: data.processingTimeMs,
        attemptCount: 1,
        validation,
        errorCode: validation.valid ? null : "OUTPUT_VALIDATION_FAILED",
        occurredAt: new Date().toISOString(),
      });
    }
  }

  if (data.userId && succeeded) {
    const { recordSuccessfulToolUse } = await import(
      "@/lib/services/usage-limit.service"
    );
    await recordSuccessfulToolUse(data.userId).catch(() => {});
  }

  if (data.userId && succeeded && data.output) {
    const { persistCompletedToolJob } = await import(
      "@/lib/services/tool-job-persistence.service"
    );
    await persistCompletedToolJob({
      userId: data.userId,
      toolName: toolSlug,
      inputFileNames: data.inputFileNames,
      outputBuffer: data.output.buffer,
      outputFileName: data.output.fileName,
      mimeType: data.output.mimeType,
      processingTimeMs: data.processingTimeMs,
    }).catch(() => {});
  }
};

export const createUploadedFileRecord = createUploadedFile;
export const getUploadedFileById = getUploadedFile;
export const deleteUploadedFileRecord = markFileDeleted;

export async function logConsentRecord(data: {
  user_id?: string | null;
  guest_session_id?: string | null;
  consent_version: string;
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  ip_hash?: string | null;
  user_agent?: string | null;
}) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createServiceClient();
  const { error } = await supabase.from("consent_records").insert({
    user_id: data.user_id ?? null,
    guest_session_id: data.guest_session_id ?? null,
    consent_version: data.consent_version,
    essential: data.essential,
    analytics: data.analytics,
    marketing: data.marketing,
    ip_hash: data.ip_hash ?? null,
    user_agent: data.user_agent ?? null,
  });

  if (error) console.error("consent_records insert failed:", error.message);
}

export async function purgeOldConsentRecords(retentionYears = 3): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createServiceClient();
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - retentionYears);

  const { data, error } = await supabase
    .from("consent_records")
    .delete()
    .lt("created_at", cutoff.toISOString())
    .select("id");

  if (error) {
    console.error("consent_records purge failed:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}

export async function purgeOldUsageLogs(retentionDays = 90): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createServiceClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const { data, error } = await supabase
    .from("usage_logs")
    .delete()
    .lt("created_at", cutoff.toISOString())
    .select("id");

  if (error) {
    console.error("usage_logs purge failed:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}

export async function purgeOldAiUsageLogs(retentionDays = 90): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createServiceClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const { data, error } = await supabase
    .from("ai_usage_logs")
    .delete()
    .lt("created_at", cutoff.toISOString())
    .select("id");

  if (error) {
    console.error("ai_usage_logs purge failed:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}

export async function purgeOldErrorLogs(retentionDays = 90): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createServiceClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const { data, error } = await supabase
    .from("error_logs")
    .delete()
    .lt("created_at", cutoff.toISOString())
    .select("id");

  if (error) {
    console.error("error_logs purge failed:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}

export async function deleteUserErrorLogs(userId: string): Promise<number> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("error_logs")
    .delete()
    .eq("user_id", userId)
    .select("id");

  if (error) {
    console.error("error_logs user delete failed:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}

export async function getUserConsentRecords(userId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("consent_records")
    .select("id, consent_version, essential, analytics, marketing, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

export async function deleteUserConsentRecords(userId: string): Promise<number> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("consent_records")
    .delete()
    .eq("user_id", userId)
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}

export async function getUserUsageLogsForExport(userId: string, limit = 500) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("usage_logs")
    .select("id, tool_name, file_size_bytes, processing_time_ms, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getUserAiUsageLogsForExport(userId: string, limit = 200) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("ai_usage_logs")
    .select(
      "id, tool_name, input_tokens, output_tokens, estimated_cost, provider, model, status, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getUserUploadedFilesMetadata(userId: string, limit = 200) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("uploaded_files")
    .select(
      "id, original_name, mime_type, file_size_bytes, is_deleted, expires_at, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getUserUploadedFilePaths(userId: string): Promise<
  { id: string; storage_path: string }[]
> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("uploaded_files")
    .select("id, storage_path")
    .eq("user_id", userId)
    .eq("is_deleted", false);

  if (error) throw error;
  return data ?? [];
}

export async function logError(data: {
  user_id?: string | null;
  tool_name?: string | null;
  error_type: string;
  error_message: string;
  stack_trace?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!isSupabaseConfigured()) {
    console.error("[pdf-doctor]", data.error_type, data.error_message);
    return;
  }

  try {
    const supabase = await createServiceClient();
    await supabase.from("error_logs").insert({
      user_id: data.user_id ?? null,
      tool_name: data.tool_name ?? null,
      error_type: data.error_type,
      error_message: data.error_message,
      stack_trace: data.stack_trace ?? null,
      metadata: data.metadata ?? {},
    });
  } catch {
    console.error("Failed to log error to database:", data.error_message);
  }

  if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
    const err = new Error(data.error_message);
    err.name = data.error_type;
    void import("@/lib/ops/sentry").then(({ captureException }) =>
      captureException(err, {
        tool_name: data.tool_name,
        error_type: data.error_type,
        user_id: data.user_id,
        ...data.metadata,
      })
    );
  }
}
