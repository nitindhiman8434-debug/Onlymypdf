import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { UsageLimitResult } from "@/lib/services/usage-limit.service";

type ReserveRpcResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
};

function mapReserveResult(
  data: ReserveRpcResult | null,
  limitMessage?: string
): UsageLimitResult {
  if (!data?.allowed) {
    return {
      allowed: false,
      remaining: Math.max(0, data?.remaining ?? 0),
      limit: data?.limit ?? 0,
      message: limitMessage,
    };
  }

  return {
    allowed: true,
    remaining: data.remaining,
    limit: data.limit,
  };
}

export async function reserveDailyUsageSlot(
  usageKey: string,
  dailyLimit: number,
  limitMessage?: string
): Promise<UsageLimitResult> {
  if (!isSupabaseConfigured()) {
    return { allowed: true, remaining: dailyLimit, limit: dailyLimit };
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("reserve_daily_usage_slot", {
    p_key: usageKey,
    p_limit: dailyLimit,
  });

  if (error) throw error;
  return mapReserveResult(data as ReserveRpcResult | null, limitMessage);
}

export async function reserveOrganizationDailyUsage(
  organizationId: string,
  dailyLimit: number,
  limitMessage?: string
): Promise<UsageLimitResult> {
  if (!isSupabaseConfigured()) {
    return { allowed: true, remaining: dailyLimit, limit: dailyLimit };
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("reserve_organization_daily_usage", {
    p_org_id: organizationId,
    p_limit: dailyLimit,
  });

  if (error) throw error;
  return mapReserveResult(data as ReserveRpcResult | null, limitMessage);
}
