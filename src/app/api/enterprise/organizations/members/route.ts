import { NextRequest, NextResponse } from "next/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { captureApiError } from "@/lib/server/safe-error";
import {
  getOrganizationMemberRole,
  listOrganizationMembers,
  removeOrganizationMember,
} from "@/lib/enterprise/organizations.service";
import { sanitizeOrganizationMemberForRole } from "@/lib/enterprise/org-member-view";

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

    const role = await getOrganizationMemberRole(organizationId, user.id);
    if (!role) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    const members = (await listOrganizationMembers(organizationId)).map((member) =>
      sanitizeOrganizationMemberForRole(member, role)
    );
    return NextResponse.json({ members });
  } catch (error) {
    captureApiError(error, { route: "enterprise/organizations/members", method: "GET" });
    return NextResponse.json({ error: "Failed to list members" }, { status: 500 });
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

    const { organizationId, userId: memberUserId } = await request.json();
    if (!organizationId || !memberUserId) {
      return NextResponse.json({ error: "organizationId and userId are required" }, { status: 400 });
    }

    await removeOrganizationMember(organizationId, memberUserId, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove member";
    captureApiError(error, { route: "enterprise/organizations/members", method: "DELETE" });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
