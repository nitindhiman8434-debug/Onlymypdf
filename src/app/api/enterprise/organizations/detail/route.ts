import { NextRequest, NextResponse } from "next/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import {
  deleteOrganizationByOwner,
  getOrganizationById,
} from "@/lib/enterprise/organizations.service";
import { captureApiError, toSafeApiError } from "@/lib/server/safe-error";

export async function GET(request: NextRequest) {
  try {
    const rate = await guardGeneralApiRateLimit(request);
    if (rate) return rate;

    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const organizationId = request.nextUrl.searchParams.get("organizationId");
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const org = await getOrganizationById(organizationId, user.id);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({ organization: org });
  } catch (error) {
    captureApiError(error, { route: "enterprise/organizations/detail", method: "GET" });
    return NextResponse.json({ error: "Failed to load organization" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await guardGeneralApiRateLimit(request);
    if (rate) return rate;

    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const body = (await request.json().catch(() => ({}))) as { organizationId?: string };
    const organizationId =
      body.organizationId ?? request.nextUrl.searchParams.get("organizationId") ?? "";

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    await deleteOrganizationByOwner(organizationId, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    captureApiError(error, { route: "enterprise/organizations/detail", method: "DELETE" });
    return NextResponse.json(
      { error: toSafeApiError(error, "Failed to delete organization") },
      { status: 400 }
    );
  }
}
