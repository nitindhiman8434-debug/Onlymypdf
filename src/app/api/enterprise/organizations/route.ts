import { NextRequest, NextResponse } from "next/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import {
  createOrganization,
  countUserOrganizations,
  MAX_ORGANIZATIONS_PER_USER,
  listUserOrganizations,
} from "@/lib/enterprise/organizations.service";
import { toSafeApiError, captureApiError } from "@/lib/server/safe-error";

export async function GET(request: NextRequest) {
  const rateLimited = await guardGeneralApiRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const organizations = await listUserOrganizations(user.id);
    return NextResponse.json({ organizations });
  } catch (error) {
    captureApiError(error, { route: "enterprise/organizations", method: "GET" });
    return NextResponse.json(
      { error: toSafeApiError(error, "Failed to load organizations") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const rateLimited = await guardGeneralApiRateLimit(request);
  if (rateLimited) return rateLimited;

  const originBlocked = guardMutationOrigin(request);
  if (originBlocked) return originBlocked;

  try {
    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2) {
      return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
    }

    const ownedCount = await countUserOrganizations(user.id);
    if (ownedCount >= MAX_ORGANIZATIONS_PER_USER) {
      return NextResponse.json(
        { error: `You can create at most ${MAX_ORGANIZATIONS_PER_USER} organizations.` },
        { status: 400 }
      );
    }

    const org = await createOrganization(user.id, {
      name,
      billingEmail: typeof body.billingEmail === "string" ? body.billingEmail : undefined,
      seatLimit: typeof body.seatLimit === "number" ? body.seatLimit : undefined,
    });

    return NextResponse.json({ organization: org }, { status: 201 });
  } catch (error) {
    captureApiError(error, { route: "enterprise/organizations", method: "POST" });
    return NextResponse.json(
      { error: toSafeApiError(error, "Failed to create organization") },
      { status: 500 }
    );
  }
}
