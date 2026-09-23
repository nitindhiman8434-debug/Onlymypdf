import { NextRequest } from "next/server";
import { createToolRoute } from "@/lib/api/tool-route";
import { runAdvancedPdfTool } from "@/lib/services/advanced-pdf-tools.service";

export const maxDuration = 600;

function parseTerms(value: FormDataEntryValue | null): string[] {
  return String(value || "")
    .split(/[\r\n,]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export const POST = async (request: NextRequest) => {
  const handler = createToolRoute({
    toolSlug: "redact-pdf",
    allowedTypes: ["pdf"],
    contentType: "application/pdf",
    outputExtension: "pdf",
    maxDuration,
    heavy: true,
    unlockPdf: true,
    convert: async (buffer, _file, formData) =>
      (
        await runAdvancedPdfTool({
          operation: "redact",
          source: buffer,
          options: { terms: parseTerms(formData.get("terms")) },
        })
      ).output,
    outputName: (name) => name.replace(/\.pdf$/i, "-redacted"),
  });
  return handler(request);
};
