"use client";

import { useCallback } from "react";
import { withLocalePrefix } from "@/lib/i18n/locale-path";

/** Normalize legacy Hindi links to their English equivalent. */
export function useLocaleHref() {
  return useCallback((path: string) => withLocalePrefix(path, "en"), []);
}
