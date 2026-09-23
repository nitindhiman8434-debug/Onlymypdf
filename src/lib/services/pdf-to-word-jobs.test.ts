import fs from "fs/promises";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  isSupabaseServiceConfigured: () => false,
  createServiceClient: vi.fn(async () => {
    throw new Error("Supabase is disabled in this test");
  }),
}));

vi.mock("@/lib/server/upstash-kv", () => ({
  isUpstashConfigured: () => false,
  getUpstashRedis: vi.fn(async () => null),
  upstashGetJson: vi.fn(async () => null),
  upstashSetJson: vi.fn(async () => false),
  upstashDel: vi.fn(async () => undefined),
}));

import {
  claimNextPdfToWordJob,
  completePdfToWordJob,
  createPdfToWordJob,
  enqueuePdfToWordJob,
  getPdfToWordJob,
  materializePdfToWordJobInput,
  notePdfToWordEngineAttempt,
  releasePdfToWordJob,
  stagePdfToWordJobInput,
} from "./pdf-to-word-jobs.service";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function validDocx() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("word/document.xml", "<w:document><w:p><w:t>Result</w:t></w:p></w:document>");
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("PDF to Word durable job lifecycle", () => {
  it("moves a staged job through queued, running and validated completion", async () => {
    const id = await createPdfToWordJob("result.docx", "owner", {
      sourceFileName: "source.pdf",
      userId: null,
      sessionId: "session",
      ipAddress: "hash",
      inputBytes: 12,
    });
    await stagePdfToWordJobInput(id, Buffer.from("%PDF-1.7\n%%EOF"));
    await enqueuePdfToWordJob(id);

    const claimed = await claimNextPdfToWordJob();
    expect(claimed?.id).toBe(id);
    expect(claimed?.job.status).toBe("running");

    const files = await materializePdfToWordJobInput(id);
    cleanup.push(files.workDir);
    await fs.writeFile(files.outputPath, await validDocx());
    await notePdfToWordEngineAttempt(id, "pdf2docx", 2);
    await completePdfToWordJob(id, {
      outputPath: files.outputPath,
      workDir: files.workDir,
      engine: "pdf2docx",
    });

    const done = await getPdfToWordJob(id);
    expect(done).toMatchObject({
      status: "done",
      progress: 100,
      engine: "pdf2docx",
      attemptCount: 2,
    });
    expect(done?.outputValidation?.valid).toBe(true);
    expect(done?.queueTimeMs).toBeGreaterThanOrEqual(0);
    expect(done?.processingTimeMs).toBeGreaterThanOrEqual(0);
    if (done) await releasePdfToWordJob(done);
  });
});
