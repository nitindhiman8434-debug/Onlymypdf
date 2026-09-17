/**
 * ConvertAPI PDF→DOCX — commercial-grade layout quality.
 * Requires CONVERTAPI_SECRET in environment.
 * @see https://www.convertapi.com/pdf-to-docx
 */

const CONVERTAPI_URL = "https://v2.convertapi.com/convert/pdf/to/docx";
const DEFAULT_TIMEOUT_MS = 180_000;
const MAX_FILE_BYTES = 100 * 1024 * 1024;

export function isConvertApiAvailable(): boolean {
  return Boolean(process.env.CONVERTAPI_SECRET?.trim());
}

function resolveTimeoutMs(): number {
  const raw = Number(process.env.CONVERTAPI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw < 30_000) return DEFAULT_TIMEOUT_MS;
  return Math.min(raw, 600_000);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function callConvertApi(
  secret: string,
  body: object,
  timeoutMs: number
): Promise<Response> {
  return fetch(CONVERTAPI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function pdfToWordConvertApi(
  fileBuffer: Buffer,
  fileName = "document.pdf"
): Promise<Buffer> {
  const secret = process.env.CONVERTAPI_SECRET?.trim();
  if (!secret) {
    throw new Error("CONVERTAPI_SECRET is not configured");
  }

  if (fileBuffer.length > MAX_FILE_BYTES) {
    throw new Error("PDF exceeds ConvertAPI size limit (100 MB)");
  }

  const body = {
    Parameters: [
      {
        Name: "File",
        FileValue: {
          Name: fileName,
          Data: fileBuffer.toString("base64"),
        },
      },
      {
        Name: "StoreFile",
        Value: false,
      },
    ],
  };

  const timeoutMs = resolveTimeoutMs();
  let response = await callConvertApi(secret, body, timeoutMs);

  if (!response.ok && isRetryableStatus(response.status)) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    response = await callConvertApi(secret, body, timeoutMs);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ConvertAPI error ${response.status}: ${text.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    Files?: Array<{ FileData?: string; FileName?: string }>;
  };

  const fileData = json.Files?.[0]?.FileData;
  if (!fileData) {
    throw new Error("ConvertAPI returned no file data");
  }

  return Buffer.from(fileData, "base64");
}

/** Write ConvertAPI result directly to disk (job mode — skip buffer in orchestrator). */
export async function pdfToWordConvertApiToPath(
  inputPath: string,
  outputPath: string,
  fileName = "document.pdf"
): Promise<void> {
  const { readFile, writeFile } = await import("fs/promises");
  const buffer = await readFile(inputPath);
  const docx = await pdfToWordConvertApi(buffer, fileName);
  await writeFile(outputPath, docx);
}
