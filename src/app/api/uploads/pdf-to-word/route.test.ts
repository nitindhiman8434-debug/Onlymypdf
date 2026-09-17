import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    createSignedUploadUrl.mockResolvedValue({
      data: {
        path: "temp-jobs/pdf-to-word/uploads/123e4567-e89b-42d3-a456-426614174000/input.pdf",
        token: "supabase-upload-token",
      },
      error: null,
    });
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
});
