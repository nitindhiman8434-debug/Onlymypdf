import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isProductionReady } from "@/lib/config/env-security";
import { isConvertApiAvailable } from "@/lib/services/pdf-to-word-convertapi.service";
import { isConvertApiOnlyMode } from "@/lib/services/pdf-to-word-engine-plan";
import { getCleanupStats } from "@/lib/services/cleanup.service";
import { isHealthDetailAuthorized } from "@/lib/ops/health-auth";
import {
  isLibreOfficeAvailable,
  LIBREOFFICE_TOOLS,
  resolveLibreOfficeBinary,
} from "@/lib/services/libreoffice-core.service";
import { isUpstashConfigured } from "@/lib/server/upstash-kv";

export const dynamic = "force-dynamic";

function publicStatus(): { status: string; httpStatus: number } {
  if (process.env.NODE_ENV !== "production") {
    return { status: "ok", httpStatus: 200 };
  }
  if (!isSupabaseConfigured() || !isProductionReady() || !isUpstashConfigured()) {
    return { status: "degraded", httpStatus: 200 };
  }
  return { status: "ok", httpStatus: 200 };
}

export async function GET(request: NextRequest) {
  const detailed = isHealthDetailAuthorized(request);
  const pub = publicStatus();

  if (!detailed) {
    return NextResponse.json(
      {
        status: pub.status,
        timestamp: new Date().toISOString(),
      },
      { status: pub.httpStatus }
    );
  }

  const checks: Record<string, { ok: boolean; detail?: string }> = {
    app: { ok: true },
    secrets: { ok: isProductionReady() },
    upstash: {
      ok: isUpstashConfigured(),
      detail: "Required for distributed rate limits in production",
    },
    libreoffice: {
      ok: isLibreOfficeAvailable(),
      detail: isLibreOfficeAvailable()
        ? `${resolveLibreOfficeBinary()} — powers ${LIBREOFFICE_TOOLS.join(", ")}`
        : "Install LibreOffice or set LIBREOFFICE_PATH for high-accuracy Office↔PDF",
    },
    convertapi: {
      ok: isConvertApiAvailable(),
      detail: isConvertApiAvailable()
        ? isConvertApiOnlyMode()
          ? "Primary PDF→Word engine (cloud, convertapi-only mode)"
          : "Primary PDF→Word engine (cloud)"
        : "Set CONVERTAPI_SECRET for Smallpdf-class PDF→Word at scale",
    },
  };

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServiceClient();
      const { error } = await supabase.from("user_profiles").select("id").limit(1);
      checks.database = { ok: !error, detail: error?.message };
    } catch (err) {
      checks.database = {
        ok: false,
        detail: err instanceof Error ? err.message : "Database unreachable",
      };
    }

    try {
      const stats = await getCleanupStats();
      checks.storage_cleanup = {
        ok: stats.pendingCleanup < 10_000,
        detail: `pending=${stats.pendingCleanup} deleted_total=${stats.totalDeleted}`,
      };
    } catch (err) {
      checks.storage_cleanup = {
        ok: false,
        detail: err instanceof Error ? err.message : "Cleanup stats failed",
      };
    }
  } else {
    checks.database = { ok: false, detail: "Supabase not configured" };
  }

  const isProd = process.env.NODE_ENV === "production";
  const allCriticalOk =
    checks.app.ok &&
    checks.secrets.ok &&
    (checks.database?.ok ?? false) &&
    (!isProd || checks.upstash.ok);

  const status = allCriticalOk ? 200 : 503;

  return NextResponse.json(
    {
      status: allCriticalOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status }
  );
}
