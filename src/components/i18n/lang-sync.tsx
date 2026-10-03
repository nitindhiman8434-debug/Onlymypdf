"use client";

import { useEffect } from "react";
import { LOCALE_COOKIE } from "@/lib/i18n/locale-path";

export function LangSync() {
  useEffect(() => {
    document.documentElement.lang = "en";
    document.documentElement.dataset.lang = "en";
    // Remove retired preferences without touching authentication or consent.
    document.cookie = `${LOCALE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
    try {
      localStorage.removeItem("pdf-doctor-language");
      localStorage.removeItem("pdf-doctor-lang");
    } catch {
      // Storage may be blocked; English rendering never depends on it.
    }
  }, []);

  return null;
}
