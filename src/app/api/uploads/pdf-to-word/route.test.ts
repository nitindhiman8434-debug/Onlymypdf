import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/tool-request-guards", () => ({
  beginToolRoute: vi.fn(async () => null),
  handleToolRouteFailure: vi.fn(async () =>
    NextResponse.json({ error: "Could not prepare the secure upload." }, { status: 500 })
  ),
}));

vi.mock("@/lib/auth/tool-mutation-auth", () => ({
  resolveMutationToolUser: vi.fn(async () => ({ denied: null, userId: null })),
}));

vi.mock("@/lib/services/user-tool-context.service", () => ({
  resolveToolUserContext: vi.fn(async () => ({ maxSizeMB: 25 })),
}));

const createSignedUploadUrl = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: vi.fn(() => true),
  createServiceClient: vi.fn(async () => ({
    storage: {
      from: vi.fn(() => ({ createSignedUploadUrl })),
    },
  })),
}));

vi.mock("@/lib/server/job-owner", () => ({
  resolveJobOwnerKey: vi.fn(() => "guest:owner"),
}));

vi.mock("@/lib/server/direct-upload-grant", () => ({
  createPdfToWordUploadGrant: vi.fn(() => "signed-owner-bound-grant"),
}));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/uploads/pdf-to-word", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PDF to Word direct upload signing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("FILE_STORAGE_PROVIDER", "supabase");
    createSignedUploadUrl.mockResolvedValue({
      data: {
        path: "temp-jobs/pdf-to-word/uploads/123e4567-e89b-42d3-a456-426614174000/input.pdf",
        token: "supabase-upload-token",
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a private signed upload token and owner-bound grant", async () => {
    const response = await POST(
      request({ fileName: "source.pdf", fileSize: 1024, mimeType: "application/pdf" })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.token).toBe("supabase-upload-token");
    expect(body.uploadGrant).toBe("signed-owner-bound-grant");
    expect(createSignedUploadUrl).toHaveBeenCalledWith(expect.stringMatching(/input\.pdf$/), {
      upsert: false,
    });
  });

  it("rejects a declared file over the current plan limit before signing", async () => {
    const response = await POST(
      request({
        fileName: "too-large.pdf",
        fileSize: 25 * 1024 * 1024 + 1,
        mimeType: "application/pdf",
      })
    );

    expect(response.status).toBe(400);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("returns a private R2 presigned PUT URL without exposing the secret key", async () => {
    const secretAccessKey = "test-r2-secret-access-key";
    vi.stubEnv("FILE_STORAGE_PROVIDER", "r2");
    vi.stubEnv("R2_ACCOUNT_ID", "0123456789abcdef0123456789abcdef");
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-r2-access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", secretAccessKey);
    vi.stubEnv("R2_BUCKET_NAME", "onlymypdf-files");

    const response = await POST(
      request({ fileName: "source.pdf", fileSize: 1024, mimeType: "application/pdf" })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.provider).toBe("r2");
    expect(body.path).toMatch(/^temp-jobs\/pdf-to-word\/uploads\/.+\/input\.pdf$/);
    expect(body.uploadUrl).toContain(".r2.cloudflarestorage.com/");
    expect(body.uploadUrl).toContain("X-Amz-Signature=");
    expect(body.expiresInSeconds).toBe(15 * 60);
    expect(body.uploadGrant).toBe("signed-owner-bound-grant");
    expect(JSON.stringify(body)).not.toContain(secretAccessKey);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });
});
