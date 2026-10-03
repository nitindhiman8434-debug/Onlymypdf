"use client";

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { create } from "zustand";
import type { Language } from "@/types";

import en from "./en.json";

export const AVAILABLE_LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
];

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

// Keep the translation API for a future language release, but do not hydrate
// a retired Hindi preference from local storage into the English-only site.
export const useLanguageStore = create<LanguageState>((set) => ({
  language: "en",
  setLanguage: () => set({ language: "en" }),
}));

function getNestedValue(obj: unknown, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return path;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : path;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`
  );
}

const LanguageContext = createContext<Language>("en");

export function LanguageProvider({ children }: { children: ReactNode }) {
  return (
    <LanguageContext.Provider value="en">
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const language = useContext(LanguageContext);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const value = getNestedValue(en, key);
      return interpolate(value, params);
    },
    []
  );

  return { t, language, setLanguage, availableLanguages: AVAILABLE_LANGUAGES };
}
