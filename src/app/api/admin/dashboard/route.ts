import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/auth/verify-admin";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { isDurableConversionQueueConfigured } from "@/lib/services/conversion-queue-provider";
import { updateAdminSetting } from "@/lib/db/queries";
import { toSafeApiError } from "@/lib/server/safe-error";
import { logAdminAction } from "@/lib/admin/audit-log";
import { getGuestUsageKey } from "@/lib/server/client-ip";
import { storedAmountInInr } from "@/lib/payment/payment-amount";

function dayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (admin instanceof Response) return admin;
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceClient = await createServiceClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const weekISO = weekStart.toISOString();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthISO = monthStart.toISOString();

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const [
      totalUsersRes,
      proUsersRes,
      filesTodayRes,
      filesYesterdayRes,
      revenueRes,
      toolUsageRes,
      recentUsageRes,
      proUsersMonthAgoRes,
    ] = await Promise.all([
      serviceClient.from("user_profiles").select("id", { count: "exact", head: true }),
      serviceClient.from("user_profiles").select("id", { count: "exact", head: true }).eq("plan", "pro"),
      serviceClient.from("usage_logs").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
      serviceClient
        .from("usage_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", yesterdayStart.toISOString())
        .lt("created_at", todayISO),
      serviceClient
        .from("payments")
        .select("amount")
        .eq("status", "completed")
        .gte("created_at", monthISO),
      serviceClient.from("usage_logs").select("tool_name, created_at").gte("created_at", weekISO),
      serviceClient
        .from("usage_logs")
        .select("id, tool_name, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(8),
      serviceClient
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("plan", "pro")
        .lt("updated_at", monthISO),
    ]);

    const revenueThisMonth =
      revenueRes.data?.reduce((sum, p) => sum + storedAmountInInr(Number(p.amount)), 0) ?? 0;

    const toolBreakdown: Record<string, number> = {};
    const dailyCounts = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      dailyCounts.set(d.toISOString().slice(0, 10), 0);
    }

    for (const row of toolUsageRes.data ?? []) {
      toolBreakdown[row.tool_name] = (toolBreakdown[row.tool_name] || 0) + 1;
      const dayKey = row.created_at?.slice(0, 10);
      if (dayKey && dailyCounts.has(dayKey)) {
        dailyCounts.set(dayKey, (dailyCounts.get(dayKey) ?? 0) + 1);
      }
    }

    const userIds = [...new Set((recentUsageRes.data ?? []).map((r) => r.user_id).filter(Boolean))];
    const emailByUser = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from("user_profiles")
        .select("id, email")
        .in("id", userIds as string[]);
      for (const p of profiles ?? []) {
        emailByUser.set(p.id, p.email);
      }
    }

    const filesToday = filesTodayRes.count ?? 0;
    const filesYesterday = filesYesterdayRes.count ?? 0;
    const fileTrend =
      filesYesterday > 0
        ? Math.round(((filesToday - filesYesterday) / filesYesterday) * 1000) / 10
        : filesToday > 0
          ? 100
          : 0;

    const proNow = proUsersRes.count ?? 0;
    const proBefore = proUsersMonthAgoRes.count ?? 0;
    const proTrend =
      proBefore > 0 ? Math.round(((proNow - proBefore) / proBefore) * 1000) / 10 : proNow > 0 ? 100 : 0;

    const dbOk = isSupabaseConfigured();
    const durableQueueOk = isDurableConversionQueueConfigured();

    return NextResponse.json({
      stats: {
        totalUsers: totalUsersRes.count ?? 0,
        proUsers: proNow,
        filesProcessedToday: filesToday,
        revenueThisMonth: Math.round(revenueThisMonth),
        usersTrend: 0,
        proTrend,
        fileTrend,
        revenueTrend: 0,
      },
      dailyUsage: [...dailyCounts.entries()].map(([iso, count]) => ({
        date: dayLabel(new Date(iso)),
        count,
      })),
      toolPopularity: Object.entries(toolBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([tool, count]) => ({ tool, count })),
      recentActivity: (recentUsageRes.data ?? []).map((row) => ({
        id: row.id,
        user: row.user_id ? emailByUser.get(row.user_id) ?? "User" : "Guest",
        action: `Used ${row.tool_name ?? "tool"}`,
        time: row.created_at
          ? new Date(row.created_at).toLocaleString()
          : "Recently",
      })),
      systemHealth: {
        database: dbOk ? "healthy" : "down",
        storage: dbOk ? "healthy" : "degraded",
        api: "healthy",
        queue: durableQueueOk
          ? "healthy"
          : process.env.NODE_ENV === "production"
            ? "degraded"
            : "healthy",
      },
    });
  } catch (err) {
    const message = toSafeApiError(err, "Failed to fetch dashboard stats");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const admin = await verifyAdmin(request);
    if (admin instanceof Response) return admin;
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "toggle-ads") {
    const serviceClient = await createServiceClient();
    const { data: current } = await serviceClient
      .from("admin_settings")
      .select("value")
      .eq("key", "ads_enabled")
      .maybeSingle();
    const next = current?.value === "true" ? "false" : "true";
    await updateAdminSetting("ads_enabled", next);
    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email ?? "admin",
      action: "settings.toggle_ads",
      targetType: "admin_settings",
      targetId: "ads_enabled",
      payload: { value: next },
      ipHash: getGuestUsageKey(request),
    });
    return NextResponse.json({ success: true, ads_enabled: next === "true" });
  }

  if (action === "toggle-maintenance") {
    const serviceClient = await createServiceClient();
    const { data: current } = await serviceClient
      .from("admin_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle();
    const next = current?.value === "true" ? "false" : "true";
    await updateAdminSetting("maintenance_mode", next);
    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email ?? "admin",
      action: "settings.toggle_maintenance",
      targetType: "admin_settings",
      targetId: "maintenance_mode",
      payload: { value: next },
      ipHash: getGuestUsageKey(request),
    });
    return NextResponse.json({ success: true, maintenance_mode: next === "true" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = toSafeApiError(err, "Dashboard action failed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
