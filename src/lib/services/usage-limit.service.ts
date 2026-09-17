import { getUserProfile, logError } from "@/lib/db/queries";
import { getCachedAdminSettings } from "@/lib/db/admin-settings-cache";
import { resolveToolUserContext } from "@/lib/services/user-tool-context.service";
import { isLocalDevAuthEnabled } from "@/lib/auth/auth-config";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { isActivePro } from "@/lib/auth/plan-access";
import { resolveProAccessForUser } from "@/lib/enterprise/org-access.service";
import {
  checkUsageLimitWithOrg,
} from "@/lib/enterprise/org-limits.service";
import {
  resolveFreeDailyToolLimit,
  resolveMaxFileSizeMB,
  resolveProDailyToolLimit,
} from "@/lib/admin/effective-limits";
import { FILE_LIMITS, isUnlimitedFileSizeMB } from "@/config/constants";
import type { NextRequest } from "next/server";
import { getGuestUsageKey } from "@/lib/server/client-ip";
import {
  reserveDailyUsageSlot,
} from "@/lib/db/daily-usage-reserve";

function resolveGuestKey(guestIpHash: string | null | NextRequest): string {
  if (guestIpHash && typeof guestIpHash === "object" && "headers" in guestIpHash) {
    return getGuestUsageKey(guestIpHash);
  }
  if (typeof guestIpHash === "string" && guestIpHash.trim()) {
    return guestIpHash.trim();
  }
  return "unknown-guest";
}

export interface UsageLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  message?: string;
}

function resolveFreeDailyLimit(settings: Record<string, unknown>): number {
  return resolveFreeDailyToolLimit(settings);
}

export async function checkUsageLimit(
  userId: string | null,
  guestIpHash: string | null | NextRequest,
  tool: string = "general"
): Promise<UsageLimitResult> {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        message: "Service temporarily unavailable. Please try again shortly.",
      };
    }
    return { allowed: true, remaining: -1, limit: -1 };
  }

  try {
    const settings = await getCachedAdminSettings();

    if (userId) {
      let orgAccess: Awaited<ReturnType<typeof resolveProAccessForUser>> | null = null;
      try {
        orgAccess = await resolveProAccessForUser(userId);
      } catch {
        orgAccess = null;
      }

      const profile = await getUserProfile(userId);
      const isPro = orgAccess?.isPro ?? isActivePro(profile);

      if (isPro) {
        if (orgAccess?.source === "organization" && orgAccess.organizationId) {
          try {
            return await checkUsageLimitWithOrg(userId, tool);
          } catch {
            return {
              allowed: false,
              remaining: 0,
              limit: 0,
              message: "Service temporarily unavailable. Please try again shortly.",
            };
          }
        }

        const dailyLimit = resolveProDailyToolLimit(settings);
        const limitMessage =
          `Daily Pro limit of ${dailyLimit} tool uses reached. Resets tomorrow.`;

        return reserveDailyUsageSlot(`user:${userId}`, dailyLimit, limitMessage);
      }

      const dailyLimit = resolveFreeDailyLimit(settings);
      const limitMessage =
        `Daily limit of ${dailyLimit} files reached. Sign up or upgrade to Pro for more uses per day.`;

      return reserveDailyUsageSlot(`user:${userId}`, dailyLimit, limitMessage);
    }

    const guestKey = resolveGuestKey(guestIpHash);
    const dailyLimit = resolveFreeDailyLimit(settings);
    const limitMessage =
      `Daily limit of ${dailyLimit} files reached. Sign up or upgrade to Pro for more.`;

    return reserveDailyUsageSlot(`guest:${guestKey}`, dailyLimit, limitMessage);
  } catch (err) {
    await logError({
      user_id: userId,
      tool_name: tool,
      error_type: "USAGE_LIMIT_CHECK_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
    }).catch(() => {});
    return { allowed: false, remaining: 0, limit: 0, message: "Service temporarily unavailable. Please try again shortly." };
  }
}

export async function requireProPlan(userId: string | null): Promise<UsageLimitResult> {
  if (!userId) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      message: "Please log in and upgrade to Pro to use this tool.",
    };
  }

  try {
    const access = await resolveProAccessForUser(userId);
    if (!access.isPro) {
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        message: "This tool requires a Pro subscription. Upgrade to continue.",
      };
    }
    return checkUsageLimit(userId, null, "pro-tool");
  } catch {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      message: "Service temporarily unavailable. Please try again shortly.",
    };
  }
}

export async function checkAIUsageLimit(
  userId: string,
  plan: "free" | "pro" = "free"
): Promise<UsageLimitResult> {
  try {
    if (isLocalDevAuthEnabled()) {
      if (plan === "pro") {
        return { allowed: true, remaining: -1, limit: -1 };
      }

      return { allowed: true, remaining: 3, limit: 3 };
    }

    const settings = await getCachedAdminSettings();
    const access = await resolveProAccessForUser(userId);
    if (access.isPro) {
      return { allowed: true, remaining: -1, limit: -1 };
    }

    const dailyLimit =
      typeof settings.free_daily_ai_limit === "number"
        ? settings.free_daily_ai_limit
        : Number(settings.free_daily_ai_limit) || 1;

    return reserveDailyUsageSlot(
      `ai:user:${userId}`,
      dailyLimit,
      `Daily AI summary limit of ${dailyLimit} reached. Upgrade to Pro for unlimited AI summaries.`
    );
  } catch (err) {
    await logError({
      user_id: userId,
      tool_name: "ai-pdf-summarizer",
      error_type: "AI_LIMIT_CHECK_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return { allowed: false, remaining: 0, limit: 1, message: "Error checking AI usage limit." };
  }
}


export async function recordSuccessfulToolUse(userId: string | null): Promise<void> {
  void userId;
  // Daily limits are reserved atomically in checkUsageLimit; no post-success increment needed.
}

export async function checkFileSizeLimit(
  userId: string | null,
  fileSizeBytes?: number,
  context?: Awaited<ReturnType<typeof resolveToolUserContext>>
): Promise<{ allowed: boolean; maxSizeMB: number }> {
  try {
    const settings = context?.settings ?? (await getCachedAdminSettings());
    let maxSizeMB = resolveMaxFileSizeMB(settings, false);

    if (userId) {
      let isPro = false;
      try {
        const access = await resolveProAccessForUser(userId);
        isPro = access.isPro;
      } catch {
        const profile = context?.profile ?? (await getUserProfile(userId));
        isPro = isActivePro(profile);
      }
      maxSizeMB = resolveMaxFileSizeMB(settings, isPro);
    } else if (context) {
      maxSizeMB = context.maxSizeMB;
    }

    if (isUnlimitedFileSizeMB(maxSizeMB)) {
      return { allowed: true, maxSizeMB: 0 };
    }

    if (fileSizeBytes === undefined) {
      return { allowed: true, maxSizeMB };
    }

    const maxBytes = maxSizeMB * 1024 * 1024;
    return {
      allowed: fileSizeBytes <= maxBytes,
      maxSizeMB,
    };
  } catch (err) {
    await logError({
      user_id: userId,
      error_type: "FILE_SIZE_CHECK_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return { allowed: false, maxSizeMB: FILE_LIMITS.maxFreeFileSizeMB };
  }
}
