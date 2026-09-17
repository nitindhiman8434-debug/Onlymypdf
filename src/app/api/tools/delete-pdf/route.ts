import { NextRequest } from "next/server";
import { createToolRoute } from "@/lib/api/tool-route";
import { resolvePdfBuffer } from "@/lib/pdf/pdf-password.server";
import { deletePdfPages } from "@/lib/services/pdf-delete.service";

export const maxDuration = 60;

export const POST = async (request: NextRequest) => {
  const handler = createToolRoute({
    toolSlug: "delete-pdf",
    allowedTypes: ["pdf"],
    contentType: "application/pdf",
    outputExtension: "pdf",
    convert: async (buffer, _file, formData) => {
      const password = (formData.get("password") as string | null) || null;
      const unlocked = await resolvePdfBuffer(buffer, password);
      const keepRaw = formData.get("pagesToKeep") as string | null;
      const pagesToKeep: number[] = keepRaw ? JSON.parse(keepRaw) : [];
      return deletePdfPages(unlocked, pagesToKeep);
    },
    outputName: (name) => name.replace(/\.pdf$/i, "-pages-removed"),
  });

  return handler(request);
};
