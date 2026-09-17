import { PDFParse, PasswordException } from "pdf-parse";
import { loadPdfDocument } from "@/lib/pdf/pdf-thumbnails.server";

export type PdfAccessResult =
  | { status: "ok"; pages: number }
  | { status: "password_required" }
  | { status: "wrong_password" }
  | { status: "unreadable"; message: string };

export function isWrongPasswordMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("incorrect password") ||
    lower.includes("wrong password") ||
    lower.includes("bad password") ||
    (lower.includes("password") &&
      (lower.includes("incorrect") ||
        lower.includes("wrong") ||
        lower.includes("does not match") ||
        lower.includes("invalid")))
  );
}

function isPasswordRelatedMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("password") ||
    lower.includes("encrypt") ||
    lower.includes("decrypt") ||
    lower.includes("cannot transfer")
  );
}

export async function probePdfAccess(
  buffer: Buffer,
  password?: string
): Promise<PdfAccessResult> {
  const parser = new PDFParse({ data: buffer, password });
  try {
    const info = await parser.getInfo();
    if (info.total > 0) {
      return { status: "ok", pages: info.total };
    }
  } catch (err) {
    if (err instanceof PasswordException) {
      const msg = (err.message || "").toLowerCase();
      if (password && (msg.includes("incorrect") || msg.includes("wrong"))) {
        return { status: "wrong_password" };
      }
      return { status: "password_required" };
    }

    const msg = err instanceof Error ? err.message : String(err);
    if (isPasswordRelatedMessage(msg)) {
      return password ? { status: "wrong_password" } : { status: "password_required" };
    }

    try {
      const doc = await loadPdfDocument(buffer, password);
      try {
        const pages = doc.numPages;
        if (pages > 0) return { status: "ok", pages };
      } finally {
        await doc.destroy();
      }
    } catch (fallbackErr) {
      const fallbackMsg =
        fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      if (isPasswordRelatedMessage(fallbackMsg)) {
        return password ? { status: "wrong_password" } : { status: "password_required" };
      }
      return {
        status: "unreadable",
        message: msg || fallbackMsg || "Could not read this PDF.",
      };
    }

    return { status: "unreadable", message: msg || "Could not read this PDF." };
  } finally {
    await parser.destroy();
  }

  try {
    const doc = await loadPdfDocument(buffer, password);
    try {
      const pages = doc.numPages;
      if (pages > 0) return { status: "ok", pages };
    } finally {
      await doc.destroy();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isPasswordRelatedMessage(msg)) {
      return password ? { status: "wrong_password" } : { status: "password_required" };
    }
    return { status: "unreadable", message: msg || "Could not read this PDF." };
  }

  return { status: "unreadable", message: "Could not read this PDF." };
}

export async function resolvePdfBuffer(
  buffer: Buffer,
  password?: string | null
): Promise<Buffer> {
  const withoutPassword = await probePdfAccess(buffer);

  if (withoutPassword.status === "ok") {
    return buffer;
  }

  if (withoutPassword.status === "unreadable") {
    throw new Error(withoutPassword.message);
  }

  if (!password) {
    throw new Error("PASSWORD_REQUIRED");
  }

  const withPassword = await probePdfAccess(buffer, password);
  if (withPassword.status === "wrong_password") {
    throw new Error("WRONG_PASSWORD");
  }
  if (withPassword.status !== "ok") {
    throw new Error(withPassword.status === "unreadable" ? withPassword.message : "WRONG_PASSWORD");
  }

  const { unlockPDF } = await import("@/lib/services/pdf-security.service");
  return unlockPDF(buffer, password);
}
