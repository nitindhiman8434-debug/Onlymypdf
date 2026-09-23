import { NextRequest } from "next/server";
import { createToolRoute } from "@/lib/api/tool-route";
import { runAdvancedPdfTool } from "@/lib/services/advanced-pdf-tools.service";
import { isValidFileType, validateFileSize } from "@/lib/utils/file";
import { validateBufferMagic } from "@/lib/utils/file-magic";
import { UnsupportedConversionInputError } from "@/lib/services/conversion-input-error";

export const maxDuration = 900;
const MAX_COMPARE_FILE_MB = 25;

export const POST = async (request: NextRequest) => {
  const handler = createToolRoute({
    toolSlug: "compare-pdf",
    allowedTypes: ["pdf"],
    contentType: "application/pdf",
    outputExtension: "pdf",
    maxDuration,
    heavy: true,
    unlockPdf: true,
    convert: async (buffer, _file, formData) => {
      const compareFile = formData.get("compareFile");
      if (!(compareFile instanceof File)) {
        throw new UnsupportedConversionInputError("Choose a second PDF for comparison");
      }
      if (!isValidFileType(compareFile, ["pdf"])) {
        throw new UnsupportedConversionInputError("The second file must be a PDF");
      }
      const size = validateFileSize(compareFile, MAX_COMPARE_FILE_MB);
      if (!size.valid) throw new UnsupportedConversionInputError(size.message ?? "Maximum compare file size is 25 MB");
      const secondSource = Buffer.from(await compareFile.arrayBuffer());
      const magic = validateBufferMagic(secondSource, ["pdf"]);
      if (!magic.valid) throw new UnsupportedConversionInputError(magic.message ?? "Invalid second PDF content");
      return (
        await runAdvancedPdfTool({
          operation: "compare",
          source: buffer,
          secondSource,
        })
      ).output;
    },
    outputName: (name) => name.replace(/\.pdf$/i, "-comparison"),
  });
  return handler(request);
};
