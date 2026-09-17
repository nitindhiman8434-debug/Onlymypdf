import { describe, expect, it } from "vitest";
import {
  isPasswordRequiredCode,
  isPasswordRequiredPayload,
  isWrongPasswordPayload,
  parseToolApiErrorPayload,
  passwordPromptFromError,
  ToolApiPasswordError,
} from "./pdf-password-errors";

describe("pdf-password-errors", () => {
  it("detects password codes across legacy and current formats", () => {
    expect(isPasswordRequiredCode("password_required")).toBe(true);
    expect(isPasswordRequiredCode("PASSWORD_REQUIRED")).toBe(true);
    expect(isPasswordRequiredCode("PDF_PASSWORD_REQUIRED")).toBe(true);
    expect(isPasswordRequiredCode("other")).toBe(false);
  });

  it("parses API payloads into typed password errors", () => {
    const required = parseToolApiErrorPayload({
      code: "password_required",
      error: "This PDF is password-protected.",
      fileName: "locked.pdf",
    });
    expect(required).toBeInstanceOf(ToolApiPasswordError);
    expect(required?.code).toBe("password_required");
    expect(required?.fileName).toBe("locked.pdf");

    const wrong = parseToolApiErrorPayload({
      error: "Incorrect password. Please try again.",
    });
    expect(wrong?.code).toBe("wrong_password");
  });

  it("falls back to message text when code is missing", () => {
    expect(
      isPasswordRequiredPayload({
        error: "This PDF is password-protected. Enter the password to continue.",
      })
    ).toBe(true);
    expect(
      isWrongPasswordPayload({
        error: "Incorrect password for document.pdf.",
      })
    ).toBe(true);
  });

  it("builds password prompt state from thrown errors", () => {
    const prompt = passwordPromptFromError(
      new ToolApiPasswordError("wrong_password", "Incorrect password.", "doc.pdf"),
      "fallback.pdf"
    );
    expect(prompt).toEqual({
      fileName: "doc.pdf",
      errorMsg: "Incorrect password.",
      loading: false,
    });
  });
});
