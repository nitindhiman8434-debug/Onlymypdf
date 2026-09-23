import { NextRequest } from "next/server";
import { createToolRoute } from "@/lib/api/tool-route";
import { runAdvancedPdfTool } from "@/lib/services/advanced-pdf-tools.service";

export const maxDuration = 300;

function numericField(formData: FormData, name: string): number {
  const value = Number(formData.get(name) ?? 0);
  return Number.isFinite(value) ? value : Number.NaN;
}

export const POST = async (request: NextRequest) => {
  const handler = createToolRoute({
    toolSlug: "crop-pdf",
    allowedTypes: ["pdf"],
    contentType: "application/pdf",
    outputExtension: "pdf",
    maxDuration,
    unlockPdf: true,
    convert: async (buffer, _file, formData) =>
      (
        await runAdvancedPdfTool({
          operation: "crop",
          source: buffer,
          options: {
            left: numericField(formData, "left"),
            top: numericField(formData, "top"),
            right: numericField(formData, "right"),
            bottom: numericField(formData, "bottom"),
          },
        })
      ).output,
    outputName: (name) => name.replace(/\.pdf$/i, "-cropped"),
  });
  return handler(request);
};
