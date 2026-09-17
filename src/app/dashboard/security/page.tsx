"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { DashboardMobileNav } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { totpQrSvgToDataUrl } from "@/lib/auth/totp-qr";
import { StepUpAuthControls } from "@/components/auth/step-up-auth-controls";

type MfaStatus = {
  enabled: boolean;
  factors: { id: string; friendlyName: string; createdAt: string }[];
};

type EnrollState = {
  factorId: string;
  qrCode?: string;
  secret?: string;
};

export default function DashboardSecurityPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enroll, setEnroll] = useState<EnrollState | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [enrollPassword, setEnrollPassword] = useState("");
  const [enrollStepUpReady, setEnrollStepUpReady] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/status", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load MFA status");
      setStatus(data as MfaStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load MFA status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function startEnroll() {
    if (!enrollStepUpReady && !enrollPassword) {
      setError("Confirm your identity to set up two-factor authentication.");
      return;
    }
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/mfa/enroll", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: enrollPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Enrollment failed");
      setEnroll({
        factorId: data.factorId,
        qrCode: data.qrCode,
        secret: data.secret,
      });
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmEnroll() {
    if (!enroll) return;
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          factorId: enroll.factorId,
          code: code.replace(/\s/g, ""),
          mode: "enroll",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("auth.mfaInvalidCode"));
      setEnroll(null);
      setCode("");
      setMessage(t("securityPage.mfaEnabledSuccess"));
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.mfaInvalidCode"));
    } finally {
      setActionLoading(false);
    }
  }

  const mfaEnabled = status?.enabled ?? false;

  return (
    <div className="pd-dashboard-content mx-auto max-w-3xl">
      <DashboardMobileNav />

      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-pd-muted hover:text-pd-brand"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("dashboard.backToOverview")}
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-pd-foreground">{t("securityPage.title")}</h1>
        <p className="mt-1 text-sm text-pd-muted">{t("securityPage.subtitle")}</p>
      </header>

      {message && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-pd-border/80 bg-pd-surface p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pd-brand-muted text-pd-brand">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-pd-foreground">{t("securityPage.mfaTitle")}</h2>
            <p className="mt-1 text-sm text-pd-muted">{t("securityPage.mfaDescription")}</p>

            {loading ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-pd-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("securityPage.loading")}
              </div>
            ) : mfaEnabled && !enroll ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <Smartphone className="h-4 w-4" />
                  {t("securityPage.mfaActive")}
                </p>
                {status?.factors[0]?.friendlyName && (
                  <p className="mt-1 text-xs text-emerald-700">
                    {status.factors[0].friendlyName}
                  </p>
                )}
              </div>
            ) : enroll ? (
              <div className="mt-4 space-y-4">
                {enroll.qrCode && (
                  <img
                    src={totpQrSvgToDataUrl(enroll.qrCode)}
                    alt={t("securityPage.mfaQrAlt")}
                    className="mx-auto w-fit rounded-xl border border-pd-border bg-white p-3"
                    width={200}
                    height={200}
                  />
                )}
                {enroll.secret && (
                  <p className="text-center font-mono text-xs text-pd-muted">
                    {t("securityPage.manualSecret")}: {enroll.secret}
                  </p>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={t("auth.mfaCodeLabel")}
                  className="w-full rounded-xl border border-pd-border px-4 py-2.5 text-center font-mono text-lg tracking-widest"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={actionLoading || code.length < 6}
                    onClick={() => void confirmEnroll()}
                  >
                    {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t("securityPage.confirmMfa")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() => {
                      setEnroll(null);
                      setCode("");
                    }}
                  >
                    {t("securityPage.cancelEnroll")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={enrollPassword}
                  onChange={(e) => setEnrollPassword(e.target.value)}
                  placeholder={t("auth.password")}
                  className="w-full rounded-xl border border-pd-border px-4 py-2.5 text-sm"
                />
                <StepUpAuthControls
                  purpose="mfa_enroll"
                  redirectTo="/dashboard/security"
                  onStepUpReady={() => setEnrollStepUpReady(true)}
                  className="mt-2"
                />
                <Button type="button" className="mt-3" disabled={actionLoading} onClick={() => void startEnroll()}>
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("securityPage.enableMfa")}
              </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-pd-border/80 bg-pd-surface p-6 shadow-sm">
        <h2 className="text-lg font-bold text-pd-foreground">{t("securityPage.ssoTitle")}</h2>
        <p className="mt-1 text-sm text-pd-muted">{t("securityPage.ssoDescription")}</p>
        <Link
          href="/dashboard/enterprise"
          className="mt-4 inline-flex text-sm font-semibold text-pd-brand hover:text-pd-brand-hover"
        >
          {t("securityPage.ssoLink")} →
        </Link>
      </section>
    </div>
  );
}
