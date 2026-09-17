import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createPdfToWordUploadGrant,
  isPdfToWordDirectUploadPath,
  verifyPdfToWordUploadGrant,
} from "./direct-upload-grant";

const originalSecret = process.env.UPLOAD_GRANT_SECRET;
const id = "123e4567-e89b-42d3-a456-426614174000";
const path = `temp-jobs/pdf-to-word/uploads/${id}/input.pdf`;

describe("PDF to Word direct upload grants", () => {
  beforeEach(() => {
    process.env.UPLOAD_GRANT_SECRET = "test-direct-upload-secret-with-enough-entropy";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.UPLOAD_GRANT_SECRET;
    else process.env.UPLOAD_GRANT_SECRET = originalSecret;
  });

  it("round trips an owner-bound grant", () => {
    const token = createPdfToWordUploadGrant({
      id,
      path,
      ownerKey: "guest:ip:session-a",
      fileName: "source.pdf",
      fileSize: 25 * 1024 * 1024,
      nowMs: 1_000,
      ttlMs: 60_000,
    });
    const grant = verifyPdfToWordUploadGrant(token, "guest:ip:session-a", 30_000);
    expect(grant.path).toBe(path);
    expect(grant.fileSize).toBe(25 * 1024 * 1024);
  });

  it("rejects tampering, another owner, and expiry", () => {
    const token = createPdfToWordUploadGrant({
      id,
      path,
      ownerKey: "guest:ip:session-a",
      fileName: "source.pdf",
      fileSize: 1024,
      nowMs: 1_000,
      ttlMs: 1_000,
    });
    expect(() => verifyPdfToWordUploadGrant(`${token}x`, "guest:ip:session-a", 1_500)).toThrow();
    expect(() => verifyPdfToWordUploadGrant(token, "guest:ip:session-b", 1_500)).toThrow(
      "owner mismatch"
    );
    expect(() => verifyPdfToWordUploadGrant(token, "guest:ip:session-a", 2_001)).toThrow(
      "expired"
    );
  });

  it("accepts only the isolated PDF to Word staging prefix", () => {
    expect(isPdfToWordDirectUploadPath(path)).toBe(true);
    expect(isPdfToWordDirectUploadPath("users/admin/private.pdf")).toBe(false);
    expect(isPdfToWordDirectUploadPath("temp-jobs/pdf-to-word/uploads/../secret/input.pdf")).toBe(
      false
    );
  });
});
