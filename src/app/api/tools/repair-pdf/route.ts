import { NextRequest } from "next/server";
import { createToolRoute } from "@/lib/api/tool-route";
import { runAdvancedPdfTool } from "@/lib/services/advanced-pdf-tools.service";

export const maxDuration = 300;

export const POST = async (request: NextRequest) => {
  const handler = createToolRoute({
    toolSlug: "repair-pdf",
    allowedTypes: ["pdf"],
    contentType: "application/pdf",
    outputExtension: "pdf",
    maxDuration,
    heavy: true,
    unlockPdf: true,
    convert: async (buffer) =>
      (await runAdvancedPdfTool({ operation: "repair", source: buffer })).output,
    outputName: (name) => name.replace(/\.pdf$/i, "-repaired"),
  });
  return handler(request);
};
