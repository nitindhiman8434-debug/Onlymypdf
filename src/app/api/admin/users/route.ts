import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/auth/verify-admin";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { toSafeApiError } from "@/lib/server/safe-error";
import { logAdminAction } from "@/lib/admin/audit-log";
import { getGuestUsageKey } from "@/lib/server/client-ip";

const ALLOWED_PLANS = new Set(["free", "pro"]);
const MAX_PAGE_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (admin instanceof Response) return admin;
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      MAX_PAGE_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20)
    );
    const search = searchParams.get("search") || "";
    const planFilter = searchParams.get("plan") || "";

    const offset = (page - 1) * limit;

    const serviceClient = await createServiceClient();
    let query = serviceClient
      .from("user_profiles")
      .select("*", { count: "exact" });

    if (search) {
      query = query.ilike("email", `%${search}%`);
    }

    if (planFilter && ALLOWED_PLANS.has(planFilter)) {
      query = query.eq("plan", planFilter);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: users, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      users: users ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    const message = toSafeApiError(err, "Failed to fetch users");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const admin = await verifyAdmin(request);
    if (admin instanceof Response) return admin;
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, plan, blocked, status } = body as {
      userId?: string;
      plan?: string;
      role?: string;
      blocked?: boolean;
      status?: string;
    };

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (userId === admin.id && (blocked === true || status === "blocked")) {
      return NextResponse.json({ error: "You cannot block your own account." }, { status: 400 });
    }

    if (body.role !== undefined) {
      return NextResponse.json(
        { error: "Role changes are not permitted through this endpoint." },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (plan !== undefined) {
      if (!ALLOWED_PLANS.has(plan)) {
        return NextResponse.json({ error: "Invalid plan. Use free or pro." }, { status: 400 });
      }
      updateData.plan = plan;
      if (plan === "pro") {
        updateData.plan_expires_at = new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000
        ).toISOString();
      } else {
        updateData.plan_expires_at = null;
      }
    }

    if (blocked !== undefined) {
      updateData.is_blocked = Boolean(blocked);
    } else if (status !== undefined) {
      updateData.is_blocked = status === "blocked";
    }

    if (Object.keys(updateData).length === 1) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const serviceClient = await createServiceClient();
    const { data: updated, error } = await serviceClient
      .from("user_profiles")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email ?? "admin",
      action: "user.update",
      targetType: "user",
      targetId: userId,
      payload: updateData,
      ipHash: getGuestUsageKey(request),
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    const message = toSafeApiError(err, "Failed to update user");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
