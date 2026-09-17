import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";
import { NextRequest, NextResponse } from "next/server";
import { deleteFile, getFileUrl } from "@/lib/services/upload.service";
import { getUploadedFileById, deleteUploadedFileRecord, logError } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import { assertMfaAal2Satisfied } from "@/lib/auth/mfa-assurance";
import { assertAccountActive } from "@/lib/auth/account-status";
import { authGuardResponse } from "@/lib/server/auth-guard-http";
import { sanitizeFilename } from "@/lib/utils/file";
import { toSafeApiError } from "@/lib/server/safe-error";
import { getGuestSessionIdFromRequest } from "@/lib/privacy/guest-session";
import { guardMutationOrigin, guardSensitiveReadOrigin } from "@/lib/server/mutation-origin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = await guardGeneralApiRateLimit(request);
  if (rateLimited) return rateLimited;

  const originBlocked = guardSensitiveReadOrigin(request);
  if (originBlocked) return originBlocked;

  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await assertMfaAal2Satisfied(supabase);
      await assertAccountActive(user.id);
    }

    const file = await getUploadedFileById(id);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (file.is_deleted) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (file.expires_at && new Date(file.expires_at) < new Date()) {
      return NextResponse.json({ error: "File has expired" }, { status: 410 });
    }

    if (file.user_id) {
      if (file.user_id !== user?.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    } else {
      const sessionId = getGuestSessionIdFromRequest(request);
      if (!sessionId || !file.guest_session_id || file.guest_session_id !== sessionId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const fileUrl = await getFileUrl(file.storage_path, file.expires_at);

    const response = await fetch(fileUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to retrieve file" }, { status: 500 });
    }

    const fileBuffer = await response.arrayBuffer();

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": file.mime_type,
        "Content-Disposition": `attachment; filename="${sanitizeFilename(file.original_name)}"`,
        "Content-Length": String(file.file_size_bytes ?? fileBuffer.byteLength),
      },
    });
  } catch (error) {
    const guarded = authGuardResponse(error);
    if (guarded) return guarded;

    const message = toSafeApiError(error, "Failed to download file");

    await logError({
      user_id: null,
      tool_name: "file-download",
      error_type: "DOWNLOAD_ERROR",
      error_message: error instanceof Error ? error.message : message,
      stack_trace: error instanceof Error ? error.stack : undefined,
    }).catch(() => {});

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = await guardGeneralApiRateLimit(request);
  if (rateLimited) return rateLimited;

  const originBlocked = guardMutationOrigin(request);
  if (originBlocked) return originBlocked;

  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await assertMfaAal2Satisfied(supabase);
      await assertAccountActive(user.id);
    }

    const file = await getUploadedFileById(id);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (file.user_id) {
      if (!user || file.user_id !== user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    } else {
      const sessionId = getGuestSessionIdFromRequest(request);
      if (!sessionId || !file.guest_session_id || file.guest_session_id !== sessionId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    await deleteFile(file.storage_path);
    await deleteUploadedFileRecord(id);

    return NextResponse.json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    const guarded = authGuardResponse(error);
    if (guarded) return guarded;

    const message = toSafeApiError(error, "Failed to delete file");

    await logError({
      user_id: null,
      tool_name: "file-delete",
      error_type: "DELETE_ERROR",
      error_message: error instanceof Error ? error.message : message,
      stack_trace: error instanceof Error ? error.stack : undefined,
    }).catch(() => {});

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
