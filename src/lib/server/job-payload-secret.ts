import crypto from "crypto";

function encryptionKey(): Buffer {
  const secret =
    process.env.JOB_PAYLOAD_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("Job payload encryption is not configured.");
  }
  return crypto
    .createHash("sha256")
    .update("onlymypdf:job-payload:v1\0")
    .update(secret || "onlymypdf-local-job-payload-development-key")
    .digest();
}

export function isJobPayloadEncryptionConfigured(): boolean {
  return Boolean(
    process.env.JOB_PAYLOAD_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  );
}

export function encryptJobPayloadSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptJobPayloadSecret(value: string): string {
  const [version, ivText, tagText, encryptedText, extra] = value.split(".");
  if (version !== "v1" || !ivText || !tagText || encryptedText === undefined || extra) {
    throw new Error("Encrypted job payload is invalid.");
  }
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivText, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Encrypted job payload is invalid.");
  }
}
