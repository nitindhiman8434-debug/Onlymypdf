import { pdfToExcel } from "@/lib/services/pdf-to-excel.service";
import { createToolRoute } from "@/lib/api/tool-route";

export const maxDuration = 600;

export const POST = createToolRoute({
  toolSlug: "pdf-to-excel",
  allowedTypes: ["pdf"],
  contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  outputExtension: "xlsx",
  heavy: true,
  unlockPdf: true,
  passwordRequiredMessage:
    "This PDF is password-protected. Enter the password to convert to Excel.",
  convert: (buffer) => pdfToExcel(buffer),
});
