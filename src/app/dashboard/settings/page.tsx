"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Trash2, Shield, Cookie, Lock } from "lucide-react";
import { DashboardMobileNav } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  CONSENT_STORAGE_KEY,
  defaultConsentAcceptAll,
  defaultConsentReject,
} from "@/lib/privacy/consent";
import { applyConsent, hydrateConsentFromServerIfMissing } from "@/lib/privacy/consent-client";
import { useTranslation } from "@/i18n";
import { StepUpAuthControls } from "@/components/auth/step-up-auth-controls";

export default function DashboardSettingsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [exportStepUpReady, setExportStepUpReady] = useState(false);
  const [deleteStepUpReady, setDeleteStepUpReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void hydrateConsentFromServerIfMissing();
  }, []);

  async function handleExport() {
    if (!exportStepUpReady && (!exportPassword || exportPassword.length < 8)) {
      setMessage(t("settingsPage.exportConfirmRequired"));
      return;
    }

    setExporting(true);
    setMessage("");
    try {
      const res = await fetch("/api/user/account", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: exportPassword }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (res.status === 403) {
          throw new Error(
            typeof json.error === "string"
              ? json.error
              : t("settingsPage.exportReauthFail")
          );
        }
        throw new Error(
          typeof json.error === "string" ? json.error : t("settingsPage.exportFail")
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `onlymypdf-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(t("settingsPage.exportDone"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("settingsPage.exportFail"));
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deleteStepUpReady && (!deletePassword || deletePassword.length < 8)) {
      setMessage(t("settingsPage.deleteConfirmRequired"));
      return;
    }

    const confirmed = window.confirm(t("settingsPage.deleteConfirm"));
    if (!confirmed) return;

    setDeleting(true);
    setMessage("");
    try {
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: deletePassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Deletion failed");
      router.push("/");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Account deletion failed.");
      setDeleting(false);
    }
  }

  function resetCookiePrefs() {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    document.cookie = "pd_consent=;path=/;max-age=0";
    setMessage("Cookie preferences cleared. Refresh the page to see the banner again.");
  }

  return (
    <div className="space-y-6">
      <DashboardMobileNav />

      <div>
        <Link
          href="/dashboard"
          className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-pd-muted hover:text-pd-brand"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("settingsPage.back")}
        </Link>
        <h1 className="text-2xl font-bold text-pd-foreground">{t("settingsPage.title")}</h1>
        <p className="mt-1 text-sm text-pd-muted">{t("settingsPage.subtitle")}</p>
      </div>

      {message ? (
        <p className="rounded-xl border border-pd-border bg-pd-surface px-4 py-3 text-sm text-pd-foreground" role="status">
          {message}
        </p>
      ) : null}

      <section className="rounded-2xl border border-pd-border bg-pd-surface p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Download className="mt-0.5 h-5 w-5 text-pd-brand" />
          <div className="flex-1">
            <h2 className="font-semibold text-pd-foreground">{t("settingsPage.exportTitle")}</h2>
            <p className="mt-1 text-sm text-pd-muted">{t("settingsPage.exportDesc")}</p>
            <label htmlFor="export-password" className="mt-4 block text-sm font-medium text-pd-foreground">
              {t("settingsPage.exportPasswordLabel")}
            </label>
            <div className="relative mt-1.5 max-w-sm">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pd-muted" />
              <input
                id="export-password"
                type="password"
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
                placeholder={t("settingsPage.exportPasswordPlaceholder")}
                className="w-full rounded-xl border border-pd-border bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-pd-brand focus:ring-2 focus:ring-pd-brand/20"
                autoComplete="current-password"
              />
            </div>
            <StepUpAuthControls
              purpose="export"
              redirectTo="/dashboard/settings"
              onStepUpReady={() => setExportStepUpReady(true)}
              className="mt-4"
            />
            <Button className="mt-3" onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? t("settingsPage.exporting") : t("settingsPage.exportBtn")}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-pd-border bg-pd-surface p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 text-pd-brand" />
          <div className="flex-1">
            <h2 className="font-semibold text-pd-foreground">{t("settingsPage.cookiesTitle")}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void applyConsent(defaultConsentAcceptAll()).then(() => {
                    setMessage(t("settingsPage.acceptAll"));
                  });
                }}
              >
                {t("settingsPage.acceptAll")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void applyConsent(defaultConsentReject()).then(() => {
                    setMessage(t("settingsPage.rejectNonEssential"));
                  });
                }}
              >
                {t("settingsPage.rejectNonEssential")}
              </Button>
              <Button variant="outline" size="sm" onClick={resetCookiePrefs}>
                {t("settingsPage.resetBanner")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
        <div className="flex items-start gap-3">
          <Trash2 className="mt-0.5 h-5 w-5 text-red-600" />
          <div className="flex-1">
            <h2 className="font-semibold text-red-900">{t("settingsPage.deleteTitle")}</h2>
            <p className="mt-1 text-sm text-red-800/90">{t("settingsPage.deleteDesc")}</p>
            <label htmlFor="delete-password" className="mt-4 block text-sm font-medium text-red-900">
              {t("settingsPage.passwordLabel")}
            </label>
            <div className="relative mt-1.5 max-w-sm">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-400" />
              <input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder={t("settingsPage.passwordPlaceholder")}
                className="w-full rounded-xl border border-red-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200"
                autoComplete="current-password"
              />
            </div>
            <StepUpAuthControls
              purpose="delete"
              redirectTo="/dashboard/settings"
              onStepUpReady={() => setDeleteStepUpReady(true)}
              className="mt-4"
            />
            <Button
              variant="outline"
              className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => void handleDeleteAccount()}
              disabled={deleting}
            >
              {deleting ? t("settingsPage.deleting") : t("settingsPage.deleteBtn")}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm">
        <div className="flex gap-2">
          <Shield className="h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-emerald-900">
            {t("settingsPage.privacyEmail")}{" "}
            <a href="mailto:privacy@onlymypdf.com" className="font-medium underline">
              privacy@onlymypdf.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
