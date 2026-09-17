import { pdfToPpt } from "@/lib/services/pdf-to-ppt.service";
import { createToolRoute } from "@/lib/api/tool-route";

export const maxDuration = 900;

export const POST = createToolRoute({
  toolSlug: "pdf-to-ppt",
  allowedTypes: ["pdf"],
  contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  outputExtension: "pptx",
  heavy: true,
  unlockPdf: true,
  passwordRequiredMessage:
    "This PDF is password-protected. Enter the password to convert to PowerPoint.",
  convert: (buffer, file) => pdfToPpt(buffer, file.name),
});
