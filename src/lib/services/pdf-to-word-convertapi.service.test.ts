import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { pdfToWordConvertApi } from "@/lib/services/pdf-to-word-convertapi.service";

describe("pdfToWordConvertApi", () => {
  const secret = "test-secret";

  beforeEach(() => {
    vi.stubEnv("CONVERTAPI_SECRET", secret);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns DOCX bytes from ConvertAPI", async () => {
    const payload = Buffer.from("PK fake-docx").toString("base64");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ Files: [{ FileData: payload }] }), { status: 200 })
      )
    );

    const result = await pdfToWordConvertApi(Buffer.from("%PDF-1.4"), "sample.pdf");
    expect(result.toString()).toContain("PK fake-docx");
  });

  it("retries once on 429", async () => {
    const payload = Buffer.from("PK retry-docx").toString("base64");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Files: [{ FileData: payload }] }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await pdfToWordConvertApi(Buffer.from("%PDF"), "a.pdf");
    expect(result.toString()).toContain("PK retry-docx");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
