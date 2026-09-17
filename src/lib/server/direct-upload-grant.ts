import crypto from "crypto";

const GRANT_VERSION = 1;
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const UPLOAD_PATH_PATTERN =
  /^temp-jobs\/pdf-to-word\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/input\.pdf$/i;

export type PdfToWordUploadGrant = {
  v: typeof GRANT_VERSION;
  id: string;
  path: string;
  ownerHash: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  expiresAt: number;
};

function signingSecret(): string {
  const value =
    process.env.UPLOAD_GRANT_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Direct upload signing is not configured.");
  }
  return "onlymypdf-local-direct-upload-development-key";
}

export function isDirectUploadGrantSigningConfigured(): boolean {
  return Boolean(
    process.env.UPLOAD_GRANT_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  );
}

function hmac(value: string): Buffer {
  return crypto
    .createHmac("sha256", signingSecret())
    .update("onlymypdf:pdf-to-word:direct-upload:v1\0")
    .update(value)
    .digest();
}

function ownerHash(ownerKey: string): string {
  return crypto
    .createHmac("sha256", signingSecret())
    .update("onlymypdf:pdf-to-word:owner:v1\0")
    .update(ownerKey)
    .digest("base64url");
}

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isGrantShape(value: unknown): value is PdfToWordUploadGrant {
  if (!value || typeof value !== "object") return false;
  const grant = value as Partial<PdfToWordUploadGrant>;
  return (
    grant.v === GRANT_VERSION &&
    typeof grant.id === "string" &&
    /^[0-9a-f-]{36}$/i.test(grant.id) &&
    typeof grant.path === "string" &&
    UPLOAD_PATH_PATTERN.test(grant.path) &&
    typeof grant.ownerHash === "string" &&
    grant.ownerHash.length >= 32 &&
    typeof grant.fileName === "string" &&
    grant.fileName.length > 0 &&
    grant.fileName.length <= 255 &&
    Number.isSafeInteger(grant.fileSize) &&
    (grant.fileSize ?? 0) > 0 &&
    grant.mimeType === "application/pdf" &&
    Number.isSafeInteger(grant.expiresAt)
  );
}

export function createPdfToWordUploadGrant(input: {
  id: string;
  path: string;
  ownerKey: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  nowMs?: number;
  ttlMs?: number;
}): string {
  if (!UPLOAD_PATH_PATTERN.test(input.path)) {
    throw new Error("Direct upload path is invalid.");
  }
  const payload: PdfToWordUploadGrant = {
    v: GRANT_VERSION,
    id: input.id,
    path: input.path,
    ownerHash: ownerHash(input.ownerKey),
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType || "application/pdf",
    expiresAt: (input.nowMs ?? Date.now()) + (input.ttlMs ?? DEFAULT_TTL_MS),
  };
  if (!isGrantShape(payload)) throw new Error("Direct upload grant is invalid.");
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${hmac(encoded).toString("base64url")}`;
}

export function verifyPdfToWordUploadGrant(
  token: string,
  ownerKey: string,
  nowMs = Date.now()
): PdfToWordUploadGrant {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) throw new Error("Direct upload grant is invalid.");
  const supplied = Buffer.from(signature, "base64url");
  const expected = hmac(encoded);
  if (!safeEqual(supplied, expected)) throw new Error("Direct upload grant is invalid.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new Error("Direct upload grant is invalid.");
  }
  if (!isGrantShape(parsed)) throw new Error("Direct upload grant is invalid.");
  if (parsed.expiresAt <= nowMs) throw new Error("Direct upload grant expired.");
  if (!safeEqual(Buffer.from(parsed.ownerHash), Buffer.from(ownerHash(ownerKey)))) {
    throw new Error("Direct upload grant owner mismatch.");
  }
  return parsed;
}

export function isPdfToWordDirectUploadPath(path: string): boolean {
  return UPLOAD_PATH_PATTERN.test(path);
}
