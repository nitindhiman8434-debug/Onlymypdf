import { NextRequest, NextResponse } from "next/server";
import { isValidFileType, validateFileSize } from "@/lib/utils/file";
import { validateBufferMagic } from "@/lib/utils/file-magic";
import { toolJsonError } from "@/lib/server/tool-api-error";

export type UploadValidationResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string; status: number };

export async function validateSingleUpload(
  file: File,
  allowedCategories: string[],
  maxSizeMB: number
): Promise<UploadValidationResult> {
  try {
    if (!isValidFileType(file, allowedCategories)) {
      return { ok: false, error: "Invalid file type.", status: 400 };
    }

    const sizeCheck = validateFileSize(file, maxSizeMB);
    if (!sizeCheck.valid) {
      return { ok: false, error: sizeCheck.message, status: 400 };
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch {
      return { ok: false, error: "Could not read uploaded file.", status: 400 };
    }

    if (buffer.length === 0) {
      return { ok: false, error: "File is empty.", status: 400 };
    }

    const magic = validateBufferMagic(buffer, allowedCategories);
    if (!magic.valid) {
      return { ok: false, error: magic.message ?? "Invalid file content.", status: 400 };
    }

    return { ok: true, buffer };
  } catch {
    return { ok: false, error: "Upload validation failed.", status: 400 };
  }
}

export async function validateMultipleUploads(
  files: File[],
  allowedCategories: string[],
  maxSizeMB: number
): Promise<UploadValidationResult & { buffers?: Buffer[] }> {
  const buffers: Buffer[] = [];

  for (const file of files) {
    const result = await validateSingleUpload(file, allowedCategories, maxSizeMB);
    if (!result.ok) {
      return result;
    }
    buffers.push(result.buffer);
  }

  return { ok: true, buffer: buffers[0] ?? Buffer.alloc(0), buffers };
}

export function uploadValidationResponse(
  request: NextRequest,
  result: Extract<UploadValidationResult, { ok: false }>
): NextResponse {
  return toolJsonError(request, result.error, result.status);
}
