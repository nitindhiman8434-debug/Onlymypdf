import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { validateConversionOutput } from "./conversion-output-validation";

async function officeFixture(kind: "docx" | "xlsx" | "pptx") {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  if (kind === "docx") {
    zip.file("word/document.xml", "<w:document><w:p><w:t>Hello</w:t></w:p></w:document>");
  } else if (kind === "xlsx") {
    zip.file("xl/workbook.xml", "<workbook/>");
    zip.file("xl/worksheets/sheet1.xml", "<worksheet><c><v>42</v></c></worksheet>");
  } else {
    zip.file("ppt/presentation.xml", "<p:presentation/>");
    zip.file("ppt/slides/slide1.xml", "<p:sld><a:t>Hello</a:t></p:sld>");
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("validateConversionOutput", () => {
  it("opens a valid PDF and counts its pages", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    pdf.addPage();
    const checked = await validateConversionOutput(Buffer.from(await pdf.save()), "pdf");
    expect(checked.valid).toBe(true);
    expect(checked.pageCount).toBe(2);
  });

  it.each(["docx", "xlsx", "pptx"] as const)(
    "opens and validates a %s package",
    async (kind) => {
      const checked = await validateConversionOutput(await officeFixture(kind), kind);
      expect(checked.valid).toBe(true);
      expect(checked.pageCount).toBe(1);
      expect(checked.textCharacters).toBeGreaterThan(0);
    }
  );

  it("rejects an extension-shaped but corrupt DOCX", async () => {
    const checked = await validateConversionOutput(Buffer.from("PK corrupt"), "docx");
    expect(checked.valid).toBe(false);
    expect(checked.openable).toBe(false);
  });

  it("rejects empty and malformed text outputs", async () => {
    expect((await validateConversionOutput(Buffer.alloc(0), "txt")).valid).toBe(false);
    expect(
      (await validateConversionOutput(Buffer.from("plain text", "utf8"), "html")).valid
    ).toBe(false);
  });
});
