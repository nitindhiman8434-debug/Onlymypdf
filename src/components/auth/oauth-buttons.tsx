"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useTranslation } from "@/i18n";
import { TurnstileWidget, getTurnstileSiteKey } from "@/components/security/turnstile-widget";

type OAuthProvider = "google" | "github" | "azure";

const providers: { id: OAuthProvider; labelKey: string; icon: React.ReactNode }[] = [
  {
    id: "google",
    labelKey: "auth.google",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
  },
  {
    id: "github",
    labelKey: "auth.github",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-1.125-.615-2.805-.21-3.495.405-.105.105-.405.405-.105.975 0 .66.405 1.275.915 1.725.825.765 2.25 1.365 3.15 1.455.945.09 1.725.345 2.385.675 1.545.855 2.985.615 3.705.465 1.125-.24 2.25-.93 2.865-1.785-2.565-.285-5.01-1.275-5.01-5.655 0-1.245.435-2.265 1.155-3.06-.12-.285-.51-1.425.12-2.955 0 0 .945-.3 3.105 1.155.9-.255 1.86-.39 2.82-.39.96 0 1.92.135 2.82.39 2.16-1.455 3.105-1.155 3.105-1.155.63 1.53.24 2.67.12 2.955.72.795 1.155 1.815 1.155 3.06 0 4.395-2.46 5.37-5.025 5.655.39.345.735.99.735 2.01 0 1.455-.015 2.625-.015 2.985 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  {
    id: "azure",
    labelKey: "auth.microsoft",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
        <path fill="#F25022" d="M1 1h10v10H1z" />
        <path fill="#7FBA00" d="M13 1h10v10H13z" />
        <path fill="#00A4EF" d="M1 13h10v10H1z" />
        <path fill="#FFB900" d="M13 13h10v10H13z" />
      </svg>
    ),
  },
];

export function OAuthButtons({
  redirectTo = "/dashboard",
  className,
}: {
  redirectTo?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileSiteKey = getTurnstileSiteKey();

  if (!isSupabaseConfigured()) return null;

  async function startOAuth(provider: OAuthProvider) {
    setError("");
    setLoadingProvider(provider);
    try {
      const res = await fetch("/api/auth/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider,
          redirectTo,
          ...(turnstileSiteKey ? { turnstileToken } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start sign-in");
      }
      window.location.assign(data.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setLoadingProvider(null);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      <p className="text-center text-xs font-medium uppercase tracking-wide text-pd-muted">
        {t("auth.orContinueWith")}
      </p>
      <div className="grid gap-2">
        {providers.map(({ id, labelKey, icon }) => (
          <button
            key={id}
            type="button"
            disabled={loadingProvider !== null || (turnstileSiteKey ? !turnstileToken : false)}
            onClick={() => void startOAuth(id)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-pd-border bg-pd-surface px-4 py-2.5 text-sm font-semibold text-pd-foreground transition hover:border-pd-brand/40 hover:bg-pd-brand-muted/30 disabled:opacity-60"
          >
            {loadingProvider === id ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
            {t(labelKey)}
          </button>
        ))}
      </div>
      {turnstileSiteKey ? (
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          onToken={setTurnstileToken}
          onExpire={() => setTurnstileToken("")}
          className="flex justify-center pt-1"
        />
      ) : null}
    </div>
  );
}
