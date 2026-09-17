import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { getLocalDevJobForDownload } from "@/lib/auth/local-dev-activity";
import { sanitizeFilename } from "@/lib/utils/file";
import { guardSensitiveReadOrigin } from "@/lib/server/mutation-origin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimited = await guardGeneralApiRateLimit(request);
    if (rateLimited) return rateLimited;

    const originBlocked = guardSensitiveReadOrigin(request);
    if (originBlocked) return originBlocked;

    const auth = await tryGetApiUser();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const { id } = await params;
    const job = await getLocalDevJobForDownload(id, user.id);
    if (!job?.storage_path) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buffer = await fs.readFile(job.storage_path);
    const isZip = job.file_name.toLowerCase().endsWith(".zip");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": isZip ? "application/zip" : "application/pdf",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(job.file_name)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
  }
}
