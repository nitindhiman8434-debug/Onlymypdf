import { createServiceClient } from "@/lib/supabase/server";

export type OrganizationAuditInput = {
  organizationId: string;
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
};

/** Best-effort org audit write — never throws into the calling path. */
export async function logOrganizationAudit(input: OrganizationAuditInput): Promise<void> {
  try {
    const supabase = await createServiceClient();
    await supabase.from("organization_audit_logs").insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId ?? null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      payload: input.payload ?? {},
    });
  } catch {
    // Audit must not block invites, billing, or membership changes.
  }
}
