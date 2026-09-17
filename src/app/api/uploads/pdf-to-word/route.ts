import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveMutationToolUser } from "@/lib/auth/tool-mutation-auth";
import { resolveToolUserContext } from "@/lib/services/user-tool-context.service";
import { beginToolRoute, handleToolRouteFailure } from "@/lib/server/tool-request-guards";
import { toolJsonError } from "@/lib/server/tool-api-error";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { resolveJobOwnerKey } from "@/lib/server/job-owner";
import { createPdfToWordUploadGrant } from "@/lib/server/direct-upload-grant";
import { getFileExtension, formatFileSize } from "@/lib/utils/file";
import { isUnlimitedFileSizeMB } from "@/config/constants";

const STORAGE_BUCKET = "pdf-files";

type DirectUploadRequest = {
  fileName?: unknown;
  fileSize?: unknown;
  mimeType?: unknown;
};

function normalizePdfMetadata(body: DirectUploadRequest):
  | { ok: true; fileName: string; fileSize: number; mimeType: "application/pdf" }
  | { ok: false; error: string } {
  if (typeof body.fileName !== "string") {
    return { ok: false, error: "PDF file name is required." };
  }
  const fileName = body.fileName.split(/[\\/]/).pop()?.trim() ?? "";
  if (!fileName || fileName.length > 255 || getFileExtension(fileName) !== "pdf") {
    return { ok: false, error: "Invalid file type. Only PDF files are accepted." };
  }
  if (!Number.isSafeInteger(body.fileSize) || (body.fileSize as number) <= 0) {
    return { ok: false, error: "PDF file size is invalid." };
  }
  const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "";
  if (mimeType && mimeType !== "application/pdf") {
    return { ok: false, error: "Invalid file type. Only PDF files are accepted." };
  }
  return {
    ok: true,
    fileName,
    fileSize: body.fileSize as number,
    mimeType: "application/pdf",
  };
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  try {
    const blocked = await beginToolRoute(request, "pdf-to-word-upload");
    if (blocked) return blocked;

    const auth = await resolveMutationToolUser(request);
    if (auth.denied) return auth.denied;
    userId = auth.userId;

    if (!isSupabaseConfigured()) {
      return toolJsonError(request, "Direct upload storage is not configured.", 503);
    }

    let body: DirectUploadRequest;
    try {
      body = (await request.json()) as DirectUploadRequest;
    } catch {
      return toolJsonError(request, "Invalid direct upload request.", 400);
    }

    const metadata = normalizePdfMetadata(body);
    if (!metadata.ok) return toolJsonError(request, metadata.error, 400);

    const context = await resolveToolUserContext(userId);
    const maxBytes = context.maxSizeMB * 1024 * 1024;
    if (!isUnlimitedFileSizeMB(context.maxSizeMB) && metadata.fileSize > maxBytes) {
      return toolJsonError(
        request,
        `File size (${formatFileSize(metadata.fileSize)}) exceeds the maximum allowed size of ${context.maxSizeMB} MB.`,
        400
      );
    }

    const ownerKey = resolveJobOwnerKey(request, userId);
    const id = crypto.randomUUID();
    const path = `temp-jobs/pdf-to-word/uploads/${id}/input.pdf`;
    const supabase = await createServiceClient();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !data?.token) throw error ?? new Error("Could not create direct upload URL.");

    const uploadGrant = createPdfToWordUploadGrant({
      id,
      path,
      ownerKey,
      fileName: metadata.fileName,
      fileSize: metadata.fileSize,
      mimeType: metadata.mimeType,
    });

    return NextResponse.json(
      {
        path: data.path || path,
        token: data.token,
        uploadGrant,
        expiresInSeconds: 15 * 60,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleToolRouteFailure(error, {
      request,
      toolSlug: "pdf-to-word-upload",
      userId,
      errorType: "DIRECT_UPLOAD_SIGN_ERROR",
      fallbackMessage: "Could not prepare the secure upload.",
    });
  }
}
