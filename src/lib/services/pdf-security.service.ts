import { encryptPDF } from "@pdfsmaller/pdf-encrypt";
import { decryptPDF } from "@pdfsmaller/pdf-decrypt";
import {
  isWrongPasswordMessage,
  probePdfAccess,
} from "@/lib/pdf/pdf-password.server";

export interface PDFEncryptionAdapter {
  encrypt(fileBuffer: Buffer, password: string): Promise<Buffer>;
  decrypt(fileBuffer: Buffer, password: string): Promise<Buffer>;
}

async function isPdfEncrypted(fileBuffer: Buffer): Promise<boolean> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    await PDFDocument.load(fileBuffer);
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    return (
      msg.includes("encrypt") ||
      msg.includes("password") ||
      msg.includes("decrypt")
    );
  }
}

function friendlyProtectError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes("already") && lower.includes("encrypt")) {
    return "This PDF is already password protected. Unlock it first, then add a new password.";
  }
  if (lower.includes("invalid") && lower.includes("pdf")) {
    return "This file does not look like a valid PDF. Try re-saving or re-scanning it.";
  }

  return raw || "Unknown encryption error";
}

export async function protectPDF(
  fileBuffer: Buffer,
  password: string,
  adapter?: PDFEncryptionAdapter
): Promise<Buffer> {
  if (!password || password.length < 1) {
    throw new Error("Password is required to protect a PDF.");
  }

  if (await isPdfEncrypted(fileBuffer)) {
    throw new Error(
      "This PDF is already password protected. Use Unlock PDF first, then protect again."
    );
  }

  try {
    if (adapter) {
      return adapter.encrypt(fileBuffer, password);
    }

    const encrypted = await encryptPDF(fileBuffer, password, {
      ownerPassword: password,
      algorithm: "AES-256",
      allowPrinting: true,
      allowCopying: true,
      allowModifying: true,
    });

    return Buffer.from(encrypted);
  } catch (err) {
    throw new Error(`Failed to protect PDF: ${friendlyProtectError(err)}`);
  }
}

export async function unlockPDF(
  fileBuffer: Buffer,
  password: string,
  adapter?: PDFEncryptionAdapter
): Promise<Buffer> {
  if (!password) {
    throw new Error("Password is required to unlock a PDF.");
  }

  if (adapter) {
    return adapter.decrypt(fileBuffer, password);
  }

  const attempts: string[] = [];

  try {
    const decrypted = await decryptPDF(fileBuffer, password);
    return Buffer.from(decrypted);
  } catch (err) {
    attempts.push(err instanceof Error ? err.message : String(err));
  }

  const access = await probePdfAccess(fileBuffer, password);
  if (access.status === "wrong_password") {
    throw new Error("Incorrect password. Please try again.");
  }
  if (access.status === "ok") {
    return fileBuffer;
  }

  if (attempts.some(isWrongPasswordMessage)) {
    throw new Error("Incorrect password. Please try again.");
  }

  throw new Error("Incorrect password. Please try again.");
}
