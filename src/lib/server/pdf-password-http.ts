import { NextRequest, NextResponse } from "next/server";
import { toolJsonError } from "@/lib/server/tool-api-error";

export const PASSWORD_REQUIRED_CODE = "password_required";
export const WRONG_PASSWORD_CODE = "wrong_password";

function fileNameFromPasswordMessage(message: string): string | undefined {
  const protectedMatch = message.match(/^(.+?) is password-protected/i);
  if (protectedMatch) return protectedMatch[1];
  const wrongMatch = message.match(/Incorrect password for (.+?)\./i);
  if (wrongMatch) return wrongMatch[1];
  return undefined;
}

export function toolPasswordRequiredError(
  request: NextRequest,
  message: string,
  fileName?: string
): NextResponse {
  return toolJsonError(request, message, 400, {
    code: PASSWORD_REQUIRED_CODE,
    ...(fileName ? { fileName } : {}),
  });
}

export function toolWrongPasswordError(
  request: NextRequest,
  message: string,
  fileName?: string
): NextResponse {
  return toolJsonError(request, message, 400, {
    code: WRONG_PASSWORD_CODE,
    ...(fileName ? { fileName } : {}),
  });
}

export function resolvePdfBufferErrorResponse(
  request: NextRequest,
  err: unknown,
  options?: {
    requiredMessage?: string;
    wrongMessage?: string;
    fileName?: string;
  }
): NextResponse | null {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "PASSWORD_REQUIRED") {
    return toolPasswordRequiredError(
      request,
      options?.requiredMessage ??
        "This PDF is password-protected. Enter the password to continue.",
      options?.fileName
    );
  }
  if (msg === "WRONG_PASSWORD") {
    return toolWrongPasswordError(
      request,
      options?.wrongMessage ?? "Incorrect password. Please try again.",
      options?.fileName
    );
  }
  return null;
}

/** Map user-facing password messages thrown during export/merge to structured API errors. */
export function passwordErrorResponseFromMessage(
  request: NextRequest,
  message: string,
  fileName?: string
): NextResponse | null {
  const resolvedName = fileName ?? fileNameFromPasswordMessage(message);
  if (message === "PASSWORD_REQUIRED") {
    return toolPasswordRequiredError(
      request,
      "This PDF is password-protected. Enter the password to continue.",
      resolvedName
    );
  }
  if (message === "WRONG_PASSWORD") {
    return toolWrongPasswordError(
      request,
      "Incorrect password. Please try again.",
      resolvedName
    );
  }
  if (/password[- ]protected|enter (the |its )?password/i.test(message)) {
    return toolPasswordRequiredError(request, message, resolvedName);
  }
  if (/incorrect password|wrong password/i.test(message)) {
    return toolWrongPasswordError(request, message, resolvedName);
  }
  return null;
}
