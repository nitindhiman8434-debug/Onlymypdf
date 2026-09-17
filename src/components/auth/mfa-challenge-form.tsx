"use client";

import { useState, type FormEvent } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTranslation } from "@/i18n";
import { resolveSafeNextPath } from "@/lib/auth/safe-redirect";
import { TurnstileWidget, getTurnstileSiteKey } from "@/components/security/turnstile-widget";

const inputClass =
  "w-full rounded-xl border border-pd-border bg-pd-surface py-2.5 text-center text-lg tracking-[0.35em] text-pd-foreground outline-none transition focus:border-pd-brand focus:ring-2 focus:ring-pd-brand/20";

export function MfaChallengeForm({
  factorId,
  challengeId,
  redirectTo,
  onCancel,
}: {
  factorId: string;
  challengeId: string;
  redirectTo: string;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileSiteKey = getTurnstileSiteKey();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          factorId,
          challengeId,
          code: code.replace(/\s/g, ""),
          mode: "login",
          ...(turnstileSiteKey ? { turnstileToken } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t("auth.mfaInvalidCode"));
      }

      window.location.assign(resolveSafeNextPath(redirectTo, "/dashboard"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.mfaInvalidCode"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pd-brand-muted text-pd-brand">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h2 className="text-lg font-bold text-pd-foreground">{t("auth.mfaTitle")}</h2>
        <p className="text-sm text-pd-muted">{t("auth.mfaSubtitle")}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="mfa-code" className="mb-1.5 block text-sm font-medium text-pd-foreground">
            {t("auth.mfaCodeLabel")}
          </label>
          <input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className={cn(inputClass, "font-mono")}
          />
        </div>

        {turnstileSiteKey ? (
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            onToken={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
            className="flex justify-center"
          />
        ) : null}

        <button
          type="submit"
          disabled={loading || code.length < 6 || (turnstileSiteKey ? !turnstileToken : false)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-pd-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pd-brand-hover disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("auth.mfaVerifyButton")}
        </button>
      </form>

      <button
        type="button"
        onClick={onCancel}
        className="w-full text-center text-sm font-medium text-pd-muted hover:text-pd-foreground"
      >
        {t("auth.mfaBackToLogin")}
      </button>
    </div>
  );
}
