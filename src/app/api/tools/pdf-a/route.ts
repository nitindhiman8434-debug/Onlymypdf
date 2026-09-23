import { NextRequest } from "next/server";
import { createToolRoute } from "@/lib/api/tool-route";
import { runAdvancedPdfTool } from "@/lib/services/advanced-pdf-tools.service";

export const maxDuration = 900;

export const POST = async (request: NextRequest) => {
  const handler = createToolRoute({
    toolSlug: "pdf-a",
    allowedTypes: ["pdf"],
    contentType: "application/pdf",
    outputExtension: "pdf",
    maxDuration,
    heavy: true,
    unlockPdf: true,
    convert: async (buffer, _file, formData) => {
      const level = String(formData.get("level") || "2b");
      return (
        await runAdvancedPdfTool({
          operation: "pdfa",
          source: buffer,
          options: { level },
        })
      ).output;
    },
    outputName: (name) => name.replace(/\.pdf$/i, "-pdfa"),
  });
  return handler(request);
};
