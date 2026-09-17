import { NextRequest, NextResponse } from "next/server";
import {
  isMaintenanceModeEnabled,
  MAINTENANCE_MESSAGE,
} from "@/lib/server/maintenance-mode";
import { guardToolRateLimit, guardApiKeyRateLimit } from "@/lib/server/rate-limiter";
import { guardToolMutationOrigin } from "@/lib/server/mutation-origin";
import { heavyJobCapacityResponse } from "@/lib/server/heavy-job-http";
import { authGuardResponse } from "@/lib/server/auth-guard-http";
import { toSafeApiError, captureApiError } from "@/lib/server/safe-error";
import { logError } from "@/lib/db/queries";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { passwordErrorResponseFromMessage } from "@/lib/server/pdf-password-http";
import { checkUsageLimit } from "@/lib/services/usage-limit.service";

export async function guardMaintenanceMode(request: NextRequest): Promise<NextResponse | null> {
  if (await isMaintenanceModeEnabled()) {
    return toolJsonError(request, MAINTENANCE_MESSAGE, 503);
  }
  return null;
}

/** Maintenance + CSRF + per-tool rate limit — call at the start of custom tool routes. */
export async function beginToolRoute(
  request: NextRequest,
  toolSlug: string
): Promise<Response | null> {
  const originBlocked = guardToolMutationOrigin(request);
  if (originBlocked) {
    return toolJsonError(request, "Invalid request origin", 403);
  }

  const maintenance = await guardMaintenanceMode(request);
  if (maintenance) return maintenance;

  const apiKeyRate = await guardApiKeyRateLimit(request, toolSlug);
  if (apiKeyRate) return apiKeyRate;

  const rate = await guardToolRateLimit(request, toolSlug);
  return rate;
}

export async function guardToolUsageLimit(
  request: NextRequest,
  toolSlug: string,
  userId: string | null
): Promise<NextResponse | null> {
  const usage = await checkUsageLimit(userId, request, toolSlug);
  if (!usage.allowed) {
    return toolJsonError(
      request,
      usage.message ?? "Daily usage limit reached.",
      429
    );
  }
  return null;
}

export type ToolRouteErrorContext = {
  request: NextRequest;
  toolSlug: string;
  userId?: string | null;
  errorType?: string;
  fallbackMessage?: string;
};

/** Standard catch handler for custom tool routes (403 blocked, 503 busy, 429 limits, safe 500). */
export async function handleToolRouteFailure(
  error: unknown,
  ctx: ToolRouteErrorContext
): Promise<NextResponse> {
  const blocked = authGuardResponse(error);
  if (blocked) return blocked;

  const capacity = heavyJobCapacityResponse(error);
  if (capacity) return capacity;

  const rawMessage = error instanceof Error ? error.message : "";
  if (rawMessage.includes("usage limit") || rawMessage.includes("limit reached")) {
    return toolJsonError(ctx.request, rawMessage, 429);
  }

  const passwordError = passwordErrorResponseFromMessage(ctx.request, rawMessage);
  if (passwordError) return passwordError;

  const message = toSafeApiError(error, ctx.fallbackMessage ?? "Processing failed");

  await logError({
    user_id: ctx.userId ?? null,
    tool_name: ctx.toolSlug,
    error_type: ctx.errorType ?? "TOOL_ERROR",
    error_message: error instanceof Error ? error.message : message,
    stack_trace: error instanceof Error ? error.stack : undefined,
  }).catch(() => {});

  captureApiError(error, { route: `tools/${ctx.toolSlug}`, user_id: ctx.userId });

  return toolJsonError(ctx.request, message, 500);
}
