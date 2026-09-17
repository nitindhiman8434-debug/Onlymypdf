import { NextResponse, type NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/rate-limiter", () => ({
  guardGeneralApiRateLimit: vi.fn(),
  checkAuthRateLimit: vi.fn(),
  checkContactRateLimit: vi.fn(),
  checkContactEmailRateLimit: vi.fn(),
  rateLimitResponse: vi.fn((retryAfterSec: number) =>
    NextResponse.json({ error: "rate limited", retryAfterSec }, { status: 429 })
  ),
}));

vi.mock("@/lib/server/mutation-origin", () => ({
  guardMutationOrigin: vi.fn(),
}));

vi.mock("@/lib/email/contact-mailer", () => ({
  sendContactEmail: vi.fn(),
}));

vi.mock("@/lib/server/safe-error", () => ({
  toSafeApiError: vi.fn((_err: unknown, fallback: string) => fallback),
  captureApiError: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
  isSupabaseConfigured: vi.fn(),
}));

vi.mock("@/lib/config/env-security", () => ({
  isProductionReady: vi.fn(),
}));

vi.mock("@/lib/ops/health-auth", () => ({
  isHealthDetailAuthorized: vi.fn(),
}));

vi.mock("@/lib/services/cleanup.service", () => ({
  cleanupExpiredFiles: vi.fn(),
  cleanupExpiredTempSessions: vi.fn(),
  purgeExpiredConsentRecords: vi.fn(),
  purgeOldUsageLogs: vi.fn(),
  purgeOldAiUsageLogs: vi.fn(),
  purgeOldErrorLogs: vi.fn(),
  getCleanupStats: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
  releaseStaleProcessingPayments: vi.fn(),
  downgradeExpiredProProfiles: vi.fn(),
}));

vi.mock("@/lib/admin/purge-audit-logs", () => ({
  purgeOldAdminAuditLogs: vi.fn(),
}));

vi.mock("@/lib/services/libreoffice-core.service", () => ({
  isLibreOfficeAvailable: vi.fn(),
  LIBREOFFICE_TOOLS: ["word-to-pdf"],
  resolveLibreOfficeBinary: vi.fn(() => "/usr/bin/libreoffice"),
}));

vi.mock("@/lib/server/upstash-kv", () => ({
  isUpstashConfigured: vi.fn(),
}));

import {
  checkContactEmailRateLimit,
  checkContactRateLimit,
  guardGeneralApiRateLimit,
} from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { sendContactEmail } from "@/lib/email/contact-mailer";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isProductionReady } from "@/lib/config/env-security";
import { isHealthDetailAuthorized } from "@/lib/ops/health-auth";
import { isUpstashConfigured } from "@/lib/server/upstash-kv";
import { isLibreOfficeAvailable } from "@/lib/services/libreoffice-core.service";
import {
  cleanupExpiredFiles,
  cleanupExpiredTempSessions,
  getCleanupStats,
} from "@/lib/services/cleanup.service";
import {
  releaseStaleProcessingPayments,
  downgradeExpiredProProfiles,
} from "@/lib/db/queries";
import { purgeOldAdminAuditLogs } from "@/lib/admin/purge-audit-logs";
import { GET as healthGET } from "@/app/api/health/route";
import { POST as contactPOST } from "@/app/api/contact/route";
import { GET as cronCleanupGET } from "@/app/api/cron/cleanup/route";

function requestJson(body: unknown, headers?: Record<string, string>): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

describe("misc API route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardGeneralApiRateLimit).mockResolvedValue(null);
    vi.mocked(checkContactRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 99,
      retryAfterSec: 0,
    });
    vi.mocked(checkContactEmailRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 99,
      retryAfterSec: 0,
    });
    vi.mocked(guardMutationOrigin).mockReturnValue(null);
    vi.mocked(sendContactEmail).mockResolvedValue({ delivered: true, mode: "email" });
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(isProductionReady).mockReturnValue(true);
    vi.mocked(isUpstashConfigured).mockReturnValue(true);
    vi.mocked(isHealthDetailAuthorized).mockReturnValue(false);
    vi.mocked(isLibreOfficeAvailable).mockReturnValue(true);
    vi.mocked(cleanupExpiredFiles).mockResolvedValue({ deleted: 1, failed: 0, batches: 1 });
    vi.mocked(cleanupExpiredTempSessions).mockResolvedValue({
      deleted: 3,
      failed: 0,
      scanned: 3,
    });
    vi.mocked(releaseStaleProcessingPayments).mockResolvedValue(0);
    vi.mocked(downgradeExpiredProProfiles).mockResolvedValue(0);
    vi.mocked(purgeOldAdminAuditLogs).mockResolvedValue(0);
    process.env.CRON_SECRET = "test-cron-secret";
  });

  it("returns public health status", async () => {
    const response = await healthGET(requestJson(null));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeTruthy();
  });

  it("sends validated contact messages", async () => {
    const response = await contactPOST(
      requestJson({
        name: "Test User",
        email: "test@example.com",
        subject: "General",
        message: "Need help with PDF merge tool please.",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(sendContactEmail).toHaveBeenCalled();
  });

  it("rejects invalid contact payloads", async () => {
    const response = await contactPOST(
      requestJson({
        name: "",
        email: "not-an-email",
        subject: "Hi",
        message: "x",
      })
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(sendContactEmail).not.toHaveBeenCalled();
  });

  it("runs cron cleanup when authorized", async () => {
    const response = await cronCleanupGET(
      requestJson(null, { authorization: "Bearer test-cron-secret" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.temp_sessions_deleted).toBe(3);
    expect(cleanupExpiredTempSessions).toHaveBeenCalled();
  });

  it("blocks cron cleanup without auth", async () => {
    const response = await cronCleanupGET(requestJson(null));

    expect(response.status).toBe(401);
    expect(cleanupExpiredTempSessions).not.toHaveBeenCalled();
  });

  it("returns detailed health checks when authorized", async () => {
    vi.mocked(isHealthDetailAuthorized).mockReturnValue(true);
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    } as never);
    vi.mocked(getCleanupStats).mockResolvedValue({
      pendingCleanup: 12,
      totalDeleted: 100,
    });

    const response = await healthGET(
      requestJson(null, { authorization: "Bearer health-secret" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checks.database.ok).toBe(true);
    expect(body.checks.storage_cleanup.detail).toContain("pending=12");
  });
});
