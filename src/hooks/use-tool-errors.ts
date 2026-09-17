"use client";

import { useCallback, useMemo } from "react";
import { useTranslation } from "@/i18n";
import {
  resolveClientToolError,
  resolveToolApiError,
  type ToolErrorPayload,
} from "@/lib/client/resolve-tool-error";
import { validateFileSize } from "@/lib/utils/file";

export function useToolErrors() {
  const { t, language } = useTranslation();

  const resolveApiError = useCallback(
    (payload: string | ToolErrorPayload | null | undefined, fallbackKey = "errors.generic") =>
      resolveToolApiError(payload, t, language, fallbackKey),
    [t, language]
  );

  const resolveCatchError = useCallback(
    (err: unknown, options?: { timeoutKey?: string; networkKey?: string }) =>
      resolveClientToolError(err, t, language, options),
    [t, language]
  );

  const fileSizeError = useCallback(
    (file: File, maxSizeMB: number): string | null => {
      const check = validateFileSize(file, maxSizeMB);
      if (check.valid) return null;
      if (file.size === 0) return t("errors.emptyFile");
      return t("errors.fileTooBig", { size: maxSizeMB });
    },
    [t]
  );

  const upload = useMemo(
    () => ({
      pdfOnly: t("toolWorkspace.pdfOnly"),
      textFilesOnly: t("toolPage.errors.textFilesOnly"),
      htmlFilesOnly: t("toolPage.errors.htmlFilesOnly"),
      imagesOnly: t("toolPage.errors.imagesOnly"),
    }),
    [t]
  );

  const messages = useMemo(
    () => ({
      wordConversionTimeout: t("toolPage.errors.wordConversionTimeout"),
      htmlConversionTimeout: t("toolPage.errors.htmlConversionTimeout"),
      protectionTimeout: t("toolPage.errors.protectionTimeout"),
      summarizationFailed: t("toolPage.errors.summarizationFailed"),
      downloadFailed: t("toolPage.errors.downloadFailed"),
      pdfPasswordRequired: t("toolPage.errors.pdfPasswordRequired"),
    }),
    [t]
  );

  return {
    t,
    language,
    resolveApiError,
    resolveCatchError,
    fileSizeError,
    upload,
    messages,
    errors: {
      generic: t("errors.generic"),
      network: t("errors.networkError"),
      processing: t("errors.processingFailed"),
      fileTooBig: (size: number | string) => t("errors.fileTooBig", { size }),
      invalidFileType: t("errors.invalidFileType"),
      emptyFile: t("errors.emptyFile"),
    },
  };
}
