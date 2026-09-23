import { NextRequest } from "next/server";
import { createToolRoute } from "@/lib/api/tool-route";
import { runAdvancedPdfTool } from "@/lib/services/advanced-pdf-tools.service";

export const maxDuration = 900;

export const POST = async (request: NextRequest) => {
  const handler = createToolRoute({
    toolSlug: "ocr-pdf",
    allowedTypes: ["pdf"],
    contentType: "application/pdf",
    outputExtension: "pdf",
    maxDuration,
    heavy: true,
    unlockPdf: true,
    convert: async (buffer, _file, formData) => {
      const languages = String(formData.get("languages") || "eng+hin");
      return (
        await runAdvancedPdfTool({
          operation: "ocr",
          source: buffer,
          options: { languages, dpi: 220, maxPages: 50 },
        })
      ).output;
    },
    outputName: (name) => name.replace(/\.pdf$/i, "-searchable"),
  });
  return handler(request);
};
