export type ToolApiErrorPayload = {
  error?: string;
  code?: string;
  fileName?: string;
};

export type PasswordPromptState = {
  fileName: string;
  errorMsg?: string;
  loading?: boolean;
};

export function isPasswordRequiredCode(code?: string): boolean {
  return code === "password_required" || code === "PASSWORD_REQUIRED" || code === "PDF_PASSWORD_REQUIRED";
}

export function isWrongPasswordCode(code?: string): boolean {
  return code === "wrong_password" || code === "WRONG_PASSWORD";
}

export function isPasswordRequiredPayload(data: ToolApiErrorPayload): boolean {
  return (
    isPasswordRequiredCode(data.code) ||
    /password[- ]protected|enter (the |its )?password/i.test(data.error ?? "")
  );
}

export function isWrongPasswordPayload(data: ToolApiErrorPayload): boolean {
  return (
    isWrongPasswordCode(data.code) ||
    /incorrect password|wrong password/i.test(data.error ?? "")
  );
}

export function isPasswordRequiredMessage(message: string): boolean {
  return /password[- ]protected|enter (the |its )?password/i.test(message);
}

export function isWrongPasswordMessage(message: string): boolean {
  return /incorrect password|wrong password/i.test(message);
}

export class ToolApiPasswordError extends Error {
  readonly code: "password_required" | "wrong_password";
  readonly fileName?: string;

  constructor(
    code: "password_required" | "wrong_password",
    message: string,
    fileName?: string
  ) {
    super(message);
    this.name = "ToolApiPasswordError";
    this.code = code;
    this.fileName = fileName;
  }
}

export function parseToolApiErrorPayload(
  data: ToolApiErrorPayload
): ToolApiPasswordError | null {
  if (isPasswordRequiredPayload(data)) {
    return new ToolApiPasswordError(
      "password_required",
      data.error ?? "This PDF is password-protected.",
      data.fileName
    );
  }
  if (isWrongPasswordPayload(data)) {
    return new ToolApiPasswordError(
      "wrong_password",
      data.error ?? "Incorrect password.",
      data.fileName
    );
  }
  return null;
}

export function passwordPromptFromError(
  err: unknown,
  fileName: string
): PasswordPromptState | null {
  if (err instanceof ToolApiPasswordError) {
    return {
      fileName: err.fileName ?? fileName,
      errorMsg: err.code === "wrong_password" ? err.message : undefined,
      loading: false,
    };
  }
  if (err instanceof Error) {
    if (isPasswordRequiredMessage(err.message)) {
      return { fileName, loading: false };
    }
    if (isWrongPasswordMessage(err.message)) {
      return { fileName, errorMsg: err.message, loading: false };
    }
  }
  return null;
}

export async function readToolApiFailure(res: Response, fallback: string): Promise<never> {
  const data = (await res.json().catch(() => ({}))) as ToolApiErrorPayload;
  const passwordError = parseToolApiErrorPayload(data);
  if (passwordError) throw passwordError;
  throw new Error(data.error ?? fallback);
}
