"use client";

import { useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useTranslation } from "@/i18n";
import { TurnstileWidget, getTurnstileSiteKey } from "@/components/security/turnstile-widget";

const inputClass =
  "w-full rounded-xl border border-pd-border bg-pd-surface py-2.5 text-sm text-pd-foreground outline-none transition focus:border-pd-brand focus:ring-2 focus:ring-pd-brand/20";

export function EnterpriseSsoForm({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  const { t } = useTranslation();
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileSiteKey = getTurnstileSiteKey();

  if (!isSupabaseConfigured()) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = domain.trim().toLowerCase();
    if (!trimmed.includes(".")) {
      setError(t("auth.ssoInvalidDomain"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          domain: trimmed,
          redirectTo,
          ...(turnstileSiteKey ? { turnstileToken } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || t("auth.ssoFailed"));
      }
      window.location.assign(data.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.ssoFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 border-t border-pd-border pt-6">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-pd-foreground">
        <Building2 className="h-4 w-4 text-pd-brand" />
        {t("auth.ssoTitle")}
      </div>
      <p className="mb-3 text-xs text-pd-muted">{t("auth.ssoSubtitle")}</p>

      {error && (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder={t("auth.ssoDomainPlaceholder")}
          className={cn(inputClass, "flex-1 px-3")}
          autoComplete="organization"
        />
        <button
          type="submit"
          disabled={loading || !domain.trim() || (turnstileSiteKey ? !turnstileToken : false)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("auth.ssoContinue")}
        </button>
      </form>
      {turnstileSiteKey ? (
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          onToken={setTurnstileToken}
          onExpire={() => setTurnstileToken("")}
          className="mt-3 flex justify-center"
        />
      ) : null}
    </div>
  );
}
