#!/usr/bin/env tsx

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { validateConversionOutput } from "../src/lib/services/conversion-output-validation";

const baseUrl = (process.env.PHASE1_SMOKE_URL || "http://localhost:3000").replace(/\/$/, "");
const fixturePath = path.resolve(
  process.env.PHASE1_SMOKE_PDF || path.join("test-lo-verify", "input.pdf")
);
const reportPath = path.resolve(
  process.env.PHASE1_SMOKE_REPORT ||
    path.join("quality", "phase1-corpus", "local-api-smoke-report.json")
);

function cookieFrom(response: Response): string {
  const raw = response.headers.get("set-cookie") || "";
  const match = raw.match(/(?:^|,\s*)(pd_guest_session=[^;]+)/i);
  if (!match) throw new Error("Guest session cookie was not returned by the app.");
  return match[1];
}

async function jsonOrThrow(response: Response) {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      `${response.status} ${typeof body.error === "string" ? body.error : response.statusText}`
    );
  }
  return body;
}

async function main() {
  const source = await fs.readFile(fixturePath);
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(source)], { type: "application/pdf" }),
    path.basename(fixturePath)
  );
  form.append("options", "{}");

  const startedAt = Date.now();
  const startResponse = await fetch(`${baseUrl}/api/tools/pdf-to-word`, {
    method: "POST",
    headers: {
      Origin: baseUrl,
      "X-Pdf-To-Word-Job": "1",
    },
    body: form,
  });
  const cookie = cookieFrom(startResponse);
  const started = await jsonOrThrow(startResponse);
  const jobId = typeof started.jobId === "string" ? started.jobId : "";
  if (!jobId) throw new Error("API did not return a conversion job ID.");

  let finalStatus: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const statusResponse = await fetch(
      `${baseUrl}/api/tools/pdf-to-word/status?jobId=${encodeURIComponent(jobId)}`,
      {
        headers: { Cookie: cookie, Origin: baseUrl },
        cache: "no-store",
      }
    );
    const status = await jsonOrThrow(statusResponse);
    if (status.status === "error") {
      throw new Error(`Conversion failed: ${String(status.error || "unknown error")}`);
    }
    if (status.status === "done") {
      finalStatus = status;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (!finalStatus) throw new Error("Conversion did not finish within three minutes.");

  const downloadResponse = await fetch(
    `${baseUrl}/api/tools/pdf-to-word/download?jobId=${encodeURIComponent(jobId)}`,
    { headers: { Cookie: cookie, Origin: baseUrl } }
  );
  if (!downloadResponse.ok) {
    throw new Error(`Download failed with HTTP ${downloadResponse.status}.`);
  }
  const output = Buffer.from(await downloadResponse.arrayBuffer());
  const validation = await validateConversionOutput(output, "docx");
  if (!validation.valid) {
    throw new Error(`DOCX validation failed: ${validation.errors.join(" ")}`);
  }

  const replay = await fetch(
    `${baseUrl}/api/tools/pdf-to-word/download?jobId=${encodeURIComponent(jobId)}`,
    { headers: { Cookie: cookie, Origin: baseUrl } }
  );
  if (replay.status !== 404) {
    throw new Error(`One-time download replay returned ${replay.status}, expected 404.`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    fixture: path.relative(process.cwd(), fixturePath).replace(/\\/g, "/"),
    inputBytes: source.length,
    outputBytes: output.length,
    outputSha256: crypto.createHash("sha256").update(output).digest("hex"),
    contentType: downloadResponse.headers.get("content-type"),
    contentDisposition: downloadResponse.headers.get("content-disposition"),
    engine: downloadResponse.headers.get("x-pdf-engine") || finalStatus.engine || null,
    queueTimeMs: finalStatus.queueTimeMs ?? null,
    processingTimeMs: finalStatus.processingTimeMs ?? Date.now() - startedAt,
    outputValid: finalStatus.outputValid,
    validation,
    oneTimeDownloadReplayStatus: replay.status,
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
