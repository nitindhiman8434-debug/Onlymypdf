import { NextRequest, NextResponse } from "next/server";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import {
  createUserApiKey,
  listUserApiKeys,
  revokeUserApiKey,
  ApiKeyOrganizationAccessError,
} from "@/lib/enterprise/api-keys.service";
import { toSafeApiError, captureApiError } from "@/lib/server/safe-error";
import { resolveProAccessForUser } from "@/lib/enterprise/org-access.service";

export async function GET(request: NextRequest) {
  const rateLimited = await guardGeneralApiRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const keys = await listUserApiKeys(user.id);
    return NextResponse.json({ keys });
  } catch (error) {
    captureApiError(error, { route: "enterprise/api-keys", method: "GET" });
    return NextResponse.json(
      { error: toSafeApiError(error, "Failed to load API keys") },
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

    const access = await resolveProAccessForUser(user.id);
    if (!access.isPro) {
      return NextResponse.json(
        { error: "API keys require an active Pro or Enterprise plan." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "Production key";
    const { record, secret } = await createUserApiKey(
      user.id,
      name,
      typeof body.organizationId === "string" ? body.organizationId : null
    );

    return NextResponse.json({ key: record, secret }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiKeyOrganizationAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    captureApiError(error, { route: "enterprise/api-keys", method: "POST" });
    return NextResponse.json(
      { error: toSafeApiError(error, "Failed to create API key") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimited = await guardGeneralApiRateLimit(request);
  if (rateLimited) return rateLimited;

  const originBlocked = guardMutationOrigin(request);
  if (originBlocked) return originBlocked;

  try {
    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const body = await request.json().catch(() => ({}));
    const keyId = typeof body.keyId === "string" ? body.keyId : "";
    if (!keyId) {
      return NextResponse.json({ error: "keyId is required" }, { status: 400 });
    }

    await revokeUserApiKey(user.id, keyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    captureApiError(error, { route: "enterprise/api-keys", method: "DELETE" });
    return NextResponse.json(
      { error: toSafeApiError(error, "Failed to revoke API key") },
      { status: 500 }
    );
  }
}
