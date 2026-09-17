import { describe, expect, it } from "vitest";
import { validateBufferMagic } from "./file-magic";

describe("validateBufferMagic", () => {
  it("rejects empty buffers", () => {
    expect(validateBufferMagic(Buffer.alloc(0), ["pdf"])).toEqual({
      valid: false,
      message: "File is empty.",
    });
  });

  it("accepts PDF magic bytes", () => {
    const pdf = Buffer.from("%PDF-1.7\n", "ascii");
    expect(validateBufferMagic(pdf, ["pdf"])).toEqual({ valid: true });
  });

  it("accepts plain text when txt is allowed", () => {
    const txt = Buffer.from("Hello PDF Doctor\n", "utf8");
    expect(validateBufferMagic(txt, ["txt"])).toEqual({ valid: true });
  });

  it("rejects mismatched categories", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateBufferMagic(png, ["pdf"])).toEqual({
      valid: false,
      message: "File content does not match the allowed file type.",
    });
  });

  it("rejects unknown binary content", () => {
    const unknown = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(validateBufferMagic(unknown, ["pdf"])).toEqual({
      valid: false,
      message: "File content does not match the declared type.",
    });
  });

  it("rejects a plain ZIP masquerading as a Word document", () => {
    const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const filler = Buffer.from("random archive contents without ooxml marker", "ascii");
    const zip = Buffer.concat([zipHeader, filler]);
    expect(validateBufferMagic(zip, ["word"])).toEqual({
      valid: false,
      message: "File content does not match the allowed file type.",
    });
  });

  it("accepts an OOXML ZIP containing the content-types marker as Word", () => {
    const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const ooxml = Buffer.concat([
      zipHeader,
      Buffer.from("....[Content_Types].xml....", "ascii"),
    ]);
    expect(validateBufferMagic(ooxml, ["word"])).toEqual({ valid: true });
  });

  it("accepts legacy OLE documents as Word", () => {
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);
    expect(validateBufferMagic(ole, ["word"])).toEqual({ valid: true });
  });

  it("rejects binary content with NUL bytes when html is allowed", () => {
    const binary = Buffer.from([0x3c, 0x00, 0x68, 0x74, 0x6d, 0x6c, 0x00, 0x01]);
    const result = validateBufferMagic(binary, ["html"]);
    expect(result.valid).toBe(false);
  });

  it("accepts HTML markup when html is allowed", () => {
    const html = Buffer.from("<!doctype html><html><body>hi</body></html>", "utf8");
    expect(validateBufferMagic(html, ["html"])).toEqual({ valid: true });
  });
});
