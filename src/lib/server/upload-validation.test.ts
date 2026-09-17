import { describe, expect, it } from "vitest";
import { validateSingleUpload } from "@/lib/server/upload-validation";

function makeFile(
  bytes: Uint8Array<ArrayBuffer> | string,
  name: string,
  type: string
): File {
  const body: Uint8Array<ArrayBuffer> =
    typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  return new File([body], name, { type });
}

describe("validateSingleUpload", () => {
  it("accepts a minimal valid PDF", async () => {
    const pdf = makeFile("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n", "test.pdf", "application/pdf");
    const result = await validateSingleUpload(pdf, ["pdf"], 25);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.buffer.length).toBeGreaterThan(0);
  });

  it("rejects empty files with 400", async () => {
    const empty = makeFile(new Uint8Array(0), "empty.pdf", "application/pdf");
    const result = await validateSingleUpload(empty, ["pdf"], 25);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/empty/i);
    }
  });

  it("rejects wrong extension/content with 400", async () => {
    const fake = makeFile("not a pdf", "fake.pdf", "application/pdf");
    const result = await validateSingleUpload(fake, ["pdf"], 25);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects image uploaded to PDF tool category", async () => {
    const png = makeFile(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      "photo.png",
      "image/png"
    );
    const result = await validateSingleUpload(png, ["pdf"], 25);
    expect(result.ok).toBe(false);
  });

  it("accepts plain text for txt category", async () => {
    const txt = makeFile("Hello world", "notes.txt", "text/plain");
    const result = await validateSingleUpload(txt, ["txt"], 25);
    expect(result.ok).toBe(true);
  });

  it("rejects a body whose bytes do not match the declared size", async () => {
    const inconsistent = {
      name: "test.pdf",
      type: "application/pdf",
      size: 25,
      arrayBuffer: async () => new TextEncoder().encode("%PDF-1.4").buffer,
    } as File;
    const result = await validateSingleUpload(inconsistent, ["pdf"], 25);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/size changed/i);
  });
});
