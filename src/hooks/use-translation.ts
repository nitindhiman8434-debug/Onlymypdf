"use client";

import { useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import en from "@/i18n/en.json";

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}

export function useTranslation() {
  const { language, setLanguage } = useAppStore();

  const t = useCallback(
    (key: string, replacements?: Record<string, string>): string => {
      let value = getNestedValue(
        en as unknown as Record<string, unknown>,
        key
      );
      if (replacements) {
        Object.entries(replacements).forEach(([k, v]) => {
          value = value.replace(`{{${k}}}`, v);
        });
      }
      return value;
    },
    []
  );

  return { t, language, setLanguage };
}
