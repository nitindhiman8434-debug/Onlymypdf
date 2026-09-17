import { beginPdfHelperRoute } from "@/lib/server/pdf-helper-guards";
import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";
import {
  cacheThumb,
  getCachedThumb,
  getPdfSessionBuffer,
} from "@/lib/pdf/pdf-session-store";
import { renderPageThumb } from "@/lib/pdf/pdf-thumbnails.server";
import { getPreviewThumbMaxWidth } from "@/lib/config/preview-limits";
import { createClient } from "@/lib/supabase/server";
import { ownerHashFromRequest } from "@/lib/server/request-security";
import { toSafeApiError } from "@/lib/server/safe-error";

export const runtime = "nodejs";
export const maxDuration = 60;

function thumbCacheKey(page: number, width: number): string {
  return width === 300 ? String(page) : `${page}@${width}`;
}

export async function GET(request: NextRequest) {
  const early = await beginPdfHelperRoute(request, "pdf-thumb", { thumbRead: true });
  if (early) return early;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ownerHash = ownerHashFromRequest(request, user?.id ?? null);

    const sessionId = request.nextUrl.searchParams.get("session");
    const page = parseInt(request.nextUrl.searchParams.get("page") ?? "0", 10);
    const widthParam = request.nextUrl.searchParams.get("width");
    const thumbMax = getPreviewThumbMaxWidth();
    const desiredWidth = widthParam
      ? Math.min(thumbMax, Math.max(40, parseInt(widthParam, 10) || 300))
      : 300;

    if (!sessionId || page < 1) {
      return toolJsonError(request, "Invalid session or page", 400);
    }

    const buffer = await getPdfSessionBuffer(sessionId, ownerHash);
    if (!buffer) {
      return toolJsonError(request, "Session expired. Re-upload the PDF.", 410);
    }

    const cacheKey = thumbCacheKey(page, desiredWidth);
    let dataUrl = await getCachedThumb(sessionId, cacheKey, ownerHash);
    if (!dataUrl) {
      dataUrl = await renderPageThumb(buffer, page, desiredWidth);
      if (dataUrl) await cacheThumb(sessionId, cacheKey, dataUrl);
    }

    if (!dataUrl) {
      return toolJsonError(request, "Could not render page", 500);
    }

    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64, "base64");

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[pdf-thumb]", error);
    return toolJsonError(
      request,
      toSafeApiError(error, "Could not render page thumbnail."),
      500
    );
  }
}
