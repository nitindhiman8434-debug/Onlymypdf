import { NextRequest, NextResponse } from "next/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { captureApiError } from "@/lib/server/safe-error";
import {
  acceptOrganizationInvite,
  createOrganizationInvite,
  getOrganizationById,
  listOrganizationInvites,
  revokeOrganizationInvite,
} from "@/lib/enterprise/organizations.service";
import { sendOrganizationInviteEmail } from "@/lib/email/org-invite-mailer";
import { APP_URL } from "@/config/constants";

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

    const invites = await listOrganizationInvites(organizationId, user.id);
    return NextResponse.json({ invites });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list invites";
    captureApiError(error, { route: "enterprise/organizations/invite", method: "GET" });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await guardGeneralApiRateLimit(request);
    if (rate) return rate;

    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const body = await request.json();
    const { organizationId, email, role } = body as {
      organizationId?: string;
      email?: string;
      role?: "admin" | "member";
    };

    if (!organizationId || !email?.includes("@")) {
      return NextResponse.json({ error: "organizationId and valid email are required" }, { status: 400 });
    }

    const invite = await createOrganizationInvite(
      organizationId,
      user.id,
      email,
      role === "admin" ? "admin" : "member"
    );

    if ("duplicate" in invite) {
      return NextResponse.json({
        success: true,
        message: "If the recipient is eligible, an invitation will be sent.",
        emailSent: true,
      });
    }

    const acceptUrl = `${APP_URL}/dashboard/enterprise#invite=${encodeURIComponent(invite.token)}`;
    let emailResult: { delivered: boolean; mode: string } | null = null;
    let emailError: string | null = null;

    try {
      const org = await getOrganizationById(organizationId, user.id);
      emailResult = await sendOrganizationInviteEmail({
        to: email.trim().toLowerCase(),
        organizationName: org?.name ?? "your team",
        acceptUrl,
        inviterEmail: user.email,
      });
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Could not send invite email";
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
    }

    return NextResponse.json({
      success: true,
      ...(process.env.NODE_ENV !== "production" ? { acceptUrl } : {}),
      expiresAt: invite.expiresAt,
      emailSent: emailResult?.delivered ?? false,
      emailMode: emailResult?.mode ?? null,
      emailError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create invite";
    captureApiError(error, { route: "enterprise/organizations/invite", method: "POST" });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await guardGeneralApiRateLimit(request);
    if (rate) return rate;

    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;
    if (!user.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: "Invite token is required" }, { status: 400 });
    }

    const result = await acceptOrganizationInvite(token, user.id, user.email);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    captureApiError(error, { route: "enterprise/organizations/invite", method: "PUT" });
    return NextResponse.json(
      { error: "Unable to accept this invitation." },
      { status: 400 }
    );
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

    const { organizationId, inviteId } = (await request.json()) as {
      organizationId?: string;
      inviteId?: string;
    };

    if (!organizationId || !inviteId) {
      return NextResponse.json({ error: "organizationId and inviteId are required" }, { status: 400 });
    }

    await revokeOrganizationInvite(organizationId, inviteId, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to revoke invite";
    captureApiError(error, { route: "enterprise/organizations/invite", method: "DELETE" });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
