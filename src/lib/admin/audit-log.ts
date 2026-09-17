import { createServiceClient } from "@/lib/supabase/server";

export type AdminAuditInput = {
  adminId: string;
  adminEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
  ipHash?: string | null;
};

export async function logAdminAction(input: AdminAuditInput): Promise<void> {
  try {
    const supabase = await createServiceClient();
    await supabase.from("admin_audit_logs").insert({
      admin_id: input.adminId,
      admin_email: input.adminEmail,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      payload: input.payload ?? {},
      ip_hash: input.ipHash ?? null,
    });
  } catch (err) {
    const { logSafeError } = await import("@/lib/server/safe-log");
    logSafeError("admin-audit", err);
  }
}

export async function listAdminAuditLogs(limit = 50, offset = 0) {
  const supabase = await createServiceClient();
  const capped = Math.min(Math.max(limit, 1), 100);
  const { data, error, count } = await supabase
    .from("admin_audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + capped - 1);

  if (error) throw error;
  return { logs: data ?? [], total: count ?? 0 };
}
