"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { EnterpriseSsoForm } from "@/components/auth/enterprise-sso-form";
import { useTranslation } from "@/i18n";
import { resolveSafeNextPath } from "@/lib/auth/safe-redirect";
import { resolveLoginFlashError, resolveLoginFlashMessage } from "@/lib/auth/login-flash";
import { TurnstileWidget, getTurnstileSiteKey } from "@/components/security/turnstile-widget";

const inputClass =
  "w-full rounded-xl border border-pd-border bg-pd-surface py-2.5 text-sm text-pd-foreground outline-none transition-colors focus:border-pd-brand focus:ring-2 focus:ring-pd-brand/20";

type MfaState = {
  factorId: string;
  challengeId: string;
};

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mfa, setMfa] = useState<MfaState | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileSiteKey = getTurnstileSiteKey();
  const searchParams = useSearchParams();
  const successMessage = resolveLoginFlashMessage(searchParams.get("message"));
  const oauthError = resolveLoginFlashError(searchParams.get("error"));
  const redirectTo = resolveSafeNextPath(searchParams.get("redirect"), "/dashboard");
  const mfaResumeStep = searchParams.get("step") === "mfa";

  useEffect(() => {
    if (!mfaResumeStep || mfa) return;

    let cancelled = false;

    async function resumePendingMfa() {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data.requiresMfa && data.mfaChallenge?.factorId && data.mfaChallenge?.challengeId) {
          setMfa({
            factorId: data.mfaChallenge.factorId,
            challengeId: data.mfaChallenge.challengeId,
          });
        }
      } catch {
        // ignore — user can log in again
      }
    }

    void resumePendingMfa();
    return () => {
      cancelled = true;
    };
  }, [mfaResumeStep, mfa]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          ...(turnstileSiteKey ? { turnstileToken } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Invalid email or password. Please try again.");
      }

      if (data.requiresMfa && data.factorId && data.challengeId) {
        setMfa({ factorId: data.factorId, challengeId: data.challengeId });
        return;
      }

      window.location.assign(redirectTo);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid email or password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (mfa) {
    return (
      <AuthShell title={t("auth.mfaTitle")} subtitle={t("auth.mfaSubtitle")}>
        <MfaChallengeForm
          factorId={mfa.factorId}
          challengeId={mfa.challengeId}
          redirectTo={redirectTo}
          onCancel={() => {
            void fetch("/api/auth/logout", { method: "POST", credentials: "include" });
            setMfa(null);
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("auth.loginTitle")} subtitle={t("auth.loginSubtitle")}>
      <div className="mb-6 hidden text-center lg:block">
        <h1 className="text-xl font-bold text-pd-foreground">{t("auth.loginTitle")}</h1>
        <p className="mt-1.5 text-sm text-pd-muted">{t("auth.loginSubtitle")}</p>
      </div>

      {successMessage && (
        <div
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          role="status"
        >
          {successMessage}
        </div>
      )}

      {(error || oauthError) && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
          {error || oauthError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-pd-foreground">
            {t("auth.email")}
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pd-muted" aria-hidden="true" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={cn(inputClass, "pl-10 pr-4")}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-pd-foreground">
            {t("auth.password")}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pd-muted" aria-hidden="true" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={cn(inputClass, "pl-10 pr-11")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-pd-muted hover:bg-pd-background hover:text-pd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pd-brand"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-pd-brand hover:text-pd-brand-hover">
            {t("auth.forgotPassword")}
          </Link>
        </div>

        <Button
          type="submit"
          disabled={loading || (turnstileSiteKey ? !turnstileToken : false)}
          className="w-full"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t("auth.loginButton")}
        </Button>
      </form>

      {turnstileSiteKey ? (
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          onToken={setTurnstileToken}
          onExpire={() => setTurnstileToken("")}
          className="mt-4 flex justify-center"
        />
      ) : null}

      <OAuthButtons redirectTo={redirectTo} className="mt-6" />
      <EnterpriseSsoForm redirectTo={redirectTo} />

      <p className="mt-6 text-center text-sm text-pd-muted">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="font-semibold text-pd-brand hover:text-pd-brand-hover">
          {t("auth.signupLink")}
        </Link>
      </p>
    </AuthShell>
  );
}
