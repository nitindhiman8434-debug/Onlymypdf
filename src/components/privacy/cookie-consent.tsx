"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Cookie } from "lucide-react";
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  defaultConsentAcceptAll,
  defaultConsentReject,
  type CookieConsentState,
} from "@/lib/privacy/consent";
import { applyConsent } from "@/lib/privacy/consent-client";
import { useFocusTrap } from "@/lib/a11y/use-focus-trap";
import { useTranslation } from "@/i18n";

export function CookieConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const dialogRef = useFocusTrap(visible);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) {
      setVisible(true);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as CookieConsentState;
      if (parsed.version !== CONSENT_VERSION) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        void finish(defaultConsentReject());
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visible]);

  async function finish(state: CookieConsentState) {
    setVisible(false);
    setShowPrefs(false);
    await applyConsent(state);
  }

  if (!visible) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-pd-border bg-pd-surface p-4 shadow-2xl sm:p-5"
    >
      <div className="pd-container max-w-4xl">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-pd-brand" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="cookie-consent-title" className="text-sm font-bold text-pd-foreground">
              {t("cookieBanner.title")}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-pd-muted sm:text-sm">
              {t("cookieBanner.body")}{" "}
              <Link href="/cookies" className="font-medium text-pd-brand hover:underline">
                {t("cookieBanner.cookiePolicy")}
              </Link>{" "}
              {t("common.and")}{" "}
              <Link href="/privacy" className="font-medium text-pd-brand hover:underline">
                {t("cookieBanner.privacyPolicy")}
              </Link>
              .
            </p>

            {showPrefs ? (
              <div className="mt-3 space-y-2 rounded-xl border border-pd-border bg-pd-background p-3 text-sm">
                <label className="flex items-center justify-between gap-3">
                  <span>
                    <span className="font-medium text-pd-foreground">{t("cookieBanner.essential")}</span>
                    <span className="block text-xs text-pd-muted">{t("cookieBanner.essentialHint")}</span>
                  </span>
                  <input type="checkbox" checked disabled className="h-4 w-4" />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>
                    <span className="font-medium text-pd-foreground">{t("cookieBanner.analytics")}</span>
                    <span className="block text-xs text-pd-muted">{t("cookieBanner.analyticsHint")}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="h-4 w-4 accent-pd-brand"
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>
                    <span className="font-medium text-pd-foreground">{t("cookieBanner.marketing")}</span>
                    <span className="block text-xs text-pd-muted">{t("cookieBanner.marketingHint")}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="h-4 w-4 accent-pd-brand"
                  />
                </label>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void finish(defaultConsentAcceptAll())}
                className="rounded-lg bg-pd-brand px-4 py-2 text-xs font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pd-brand focus-visible:ring-offset-2"
              >
                {t("cookieBanner.acceptAll")}
              </button>
              <button
                type="button"
                onClick={() => void finish(defaultConsentReject())}
                className="rounded-lg border border-pd-border px-4 py-2 text-xs font-semibold text-pd-foreground hover:bg-pd-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pd-brand focus-visible:ring-offset-2"
              >
                {t("cookieBanner.rejectNonEssential")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (showPrefs) {
                    void finish({
                      version: CONSENT_VERSION,
                      essential: true,
                      analytics,
                      marketing,
                      decidedAt: new Date().toISOString(),
                    });
                  } else {
                    setShowPrefs(true);
                  }
                }}
                aria-expanded={showPrefs}
                className="rounded-lg border border-pd-border px-4 py-2 text-xs font-semibold text-pd-muted hover:bg-pd-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pd-brand focus-visible:ring-offset-2"
              >
                {showPrefs ? t("cookieBanner.savePreferences") : t("cookieBanner.customize")}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void finish(defaultConsentReject())}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-pd-muted hover:bg-pd-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pd-brand"
            aria-label={t("cookieBanner.dismissAria")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
