import { NextRequest } from "next/server";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { renderPdf, logUsage, preprocess } = vi.hoisted(() => ({
  renderPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.7\nscanner-test")),
  logUsage: vi.fn().mockResolvedValue(undefined),
  preprocess: vi.fn(),
}));
vi.mock("@/lib/server/tool-request-guards", () => ({
  beginToolRoute: vi.fn().mockResolvedValue(null),
  handleToolRouteFailure: vi.fn(async () => {
    const { NextResponse } = await import("next/server");
    return NextResponse.json({ error: "Failed to create scanned PDF" }, { status: 500 });
  }),
}));
vi.mock("@/lib/auth/tool-mutation-auth", () => ({
  resolveMutationToolUser: vi.fn().mockResolvedValue({ userId: null, denied: null }),
}));
vi.mock("@/lib/services/usage-limit.service", () => ({
  checkUsageLimit: vi.fn().mockResolvedValue({ allowed: true }),
  checkFileSizeLimit: vi.fn().mockResolvedValue({ maxSizeMB: 25 }),
}));
vi.mock("@/lib/db/queries", () => ({ logToolUsage: logUsage }));
vi.mock("@/lib/services/pdf-convert.service", () => ({ jpgToPdf: renderPdf }));
vi.mock("@/lib/services/pdf-scanner-image", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/pdf-scanner-image")>();
  return { prepareScannerImage: preprocess.mockImplementation(actual.prepareScannerImage) };
});
import { POST } from "./route";

async function fixture(name = "scan.png", grey = 180) {
  const bytes = await sharp({ create: { width: 8, height: 8, channels: 3,
    background: { r: grey, g: grey, b: grey } } }).png().toBuffer();
  return new File([new Uint8Array(bytes)], name, { type: "image/png" });
}
function request(files: (File | string)[], filter: string | File | null = "original", duplicate = false) {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  if (filter !== null) form.append("filter", filter);
  if (duplicate) form.append("filter", "bw");
  return new NextRequest("http://localhost/api/tools/pdf-scanner", { method: "POST", body: form });
}

describe("scanner request contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([["original", "none"], ["bw", "blackwhite"], ["enhanced", "highcontrast"], [null, "none"]])
    ("honors UI filter %s before rendering", async (filter, expected) => {
      const response = await POST(request([await fixture()], filter));
      expect(response.status).toBe(200);
      expect(preprocess).toHaveBeenCalledWith(expect.any(Buffer), expected);
      expect(renderPdf).toHaveBeenCalledWith([expect.any(Buffer)], { pageSize: "a4", orientation: "portrait", margin: "small" });
      expect(response.headers.get("content-type")).toBe("application/pdf");
      expect(response.headers.get("content-disposition")).toContain("scanned-document.pdf");
    });

  it("accepts exactly 10 images and preserves their order", async () => {
    const files = await Promise.all(Array.from({ length: 10 }, (_, i) => fixture(`${i}.png`, i * 20)));
    const response = await POST(request(files));
    expect(response.status).toBe(200);
    const images = renderPdf.mock.calls[0][0] as Buffer[];
    expect(images).toHaveLength(10);
    for (const [i, image] of images.entries()) {
      const raw = await sharp(image).removeAlpha().raw().toBuffer();
      expect(raw[0]).toBe(i * 20);
    }
    expect(logUsage).toHaveBeenCalledOnce();
  });

  it("rejects 11 images before processing any image", async () => {
    const file = await fixture();
    const response = await POST(request(Array(11).fill(file)));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("10");
    expect(preprocess).not.toHaveBeenCalled();
    expect(renderPdf).not.toHaveBeenCalled();
  });

  it.each(["invalid", "BW"])("rejects unknown filter %s without rendering", async (filter) => {
    expect((await POST(request([await fixture()], filter))).status).toBe(400);
    expect(preprocess).not.toHaveBeenCalled();
    expect(renderPdf).not.toHaveBeenCalled();
  });

  it("rejects a file-valued filter and ambiguous duplicate filters", async () => {
    const file = await fixture();
    expect((await POST(request([file], file))).status).toBe(400);
    expect((await POST(request([file], "original", true))).status).toBe(400);
    expect(preprocess).not.toHaveBeenCalled();
  });

  it("rejects empty and non-file uploads", async () => {
    expect((await POST(request([]))).status).toBe(400);
    expect((await POST(request(["not an image"]))).status).toBe(400);
    expect(renderPdf).not.toHaveBeenCalled();
  });

  it("rejects a mixed invalid batch before producing any partial PDF", async () => {
    const invalid = new File(["not real PNG bytes"], "broken.png", { type: "image/png" });
    const response = await POST(request([await fixture(), invalid]));
    expect(response.status).toBe(400);
    expect(preprocess).not.toHaveBeenCalled();
    expect(renderPdf).not.toHaveBeenCalled();
    expect(logUsage).not.toHaveBeenCalled();
  });

  it("returns a file error rather than a PDF when decodable image content is truncated", async () => {
    const bytes = Buffer.from(await (await fixture()).arrayBuffer()).subarray(0, 20);
    const response = await POST(request([new File([bytes], "truncated.png", { type: "image/png" })]));
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(renderPdf).not.toHaveBeenCalled();
  });
});
