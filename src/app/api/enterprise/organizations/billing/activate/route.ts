import { NextRequest, NextResponse } from "next/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import { captureApiError } from "@/lib/server/safe-error";
import {
  activateOrganizationBilling,
  cancelOrganizationAutoRenew,
} from "@/lib/enterprise/org-billing.service";
import { EnterpriseSalesRequiredError } from "@/lib/enterprise/enterprise-sales";

export async function POST(request: NextRequest) {
  try {
    const originBlocked = guardMutationOrigin(request);
    if (originBlocked) return originBlocked;

    const rate = await guardGeneralApiRateLimit(request);
    if (rate) return rate;

    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const { organizationId, duration } = (await request.json()) as {
      organizationId?: string;
      duration?: "monthly" | "yearly";
    };

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const result = await activateOrganizationBilling(
      organizationId,
      user.id,
      duration === "yearly" ? "yearly" : "monthly"
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof EnterpriseSalesRequiredError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          salesEmail: error.salesEmail,
        },
        { status: 403 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to activate team billing";
    captureApiError(error, { route: "enterprise/organizations/billing/activate", method: "POST" });
    return NextResponse.json({ error: message }, { status: 400 });
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

    const { organizationId } = (await request.json()) as { organizationId?: string };
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    await cancelOrganizationAutoRenew(organizationId, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel team billing";
    captureApiError(error, { route: "enterprise/organizations/billing/activate", method: "DELETE" });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
