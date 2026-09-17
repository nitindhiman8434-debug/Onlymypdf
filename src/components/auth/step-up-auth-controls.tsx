"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OAuthProvider } from "@/lib/auth/user-auth-methods";
import type { StepUpPurpose } from "@/lib/auth/step-up-auth";

type AuthMethods = {
  hasPassword: boolean;
  oauthProviders: OAuthProvider[];
};

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: "Google",
  github: "GitHub",
  azure: "Microsoft",
};

type StepUpAuthControlsProps = {
  purpose: StepUpPurpose;
  redirectTo: string;
  onStepUpReady?: () => void;
  className?: string;
};

export function StepUpAuthControls({
  purpose,
  redirectTo,
  onStepUpReady,
  className,
}: StepUpAuthControlsProps) {
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState("");
  const [stepUpReady, setStepUpReady] = useState(false);

  const checkStepUpStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/auth/reauth/status?purpose=${encodeURIComponent(purpose)}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ready === true) {
        setStepUpReady(true);
        onStepUpReady?.();
      }
    } catch {
      // ignore — user can confirm via password or retry OAuth
    }
  }, [purpose, onStepUpReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("stepUpError") === "1") {
      setError("Identity confirmation failed. Sign in with the same account and try again.");
      params.delete("stepUpError");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    }
    void checkStepUpStatus();
  }, [checkStepUpStatus]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/reauth/methods", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not load sign-in methods.");
        if (!cancelled) setMethods(data as AuthMethods);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load sign-in methods.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const startOAuthStepUp = useCallback(
    async (provider: OAuthProvider) => {
      setError("");
      setOauthLoading(provider);
      try {
        const res = await fetch("/api/auth/reauth/oauth", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose, redirectTo }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
          throw new Error(data.error || "Could not start identity confirmation.");
        }
        window.location.assign(data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start identity confirmation.");
        setOauthLoading(null);
      }
    },
    [purpose, redirectTo]
  );

  if (loading) {
    return (
      <p className={`flex items-center gap-2 text-sm text-pd-muted ${className ?? ""}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading confirmation options…
      </p>
    );
  }

  if (!methods) {
    return error ? (
      <p className={`text-sm text-pd-danger ${className ?? ""}`} role="alert">
        {error}
      </p>
    ) : null;
  }

  const showOAuth = methods.oauthProviders.length > 0;

  if (!methods.hasPassword && !showOAuth) {
    return (
      <p className={`text-sm text-pd-muted ${className ?? ""}`}>
        No confirmation method is available for this account. Contact support.
      </p>
    );
  }

  return (
    <div className={className}>
      {stepUpReady ? (
        <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Identity confirmed. You can proceed now.
        </p>
      ) : null}

      {showOAuth ? (
        <div className="space-y-2">
          <p className="text-sm text-pd-muted">
            {methods.hasPassword
              ? "Or confirm with your linked sign-in provider:"
              : "Confirm with your sign-in provider:"}
          </p>
          <div className="flex flex-wrap gap-2">
            {methods.oauthProviders.map((provider) => (
              <Button
                key={provider}
                type="button"
                variant="outline"
                disabled={oauthLoading != null}
                onClick={() => void startOAuthStepUp(provider)}
              >
                {oauthLoading === provider ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Confirm with {PROVIDER_LABELS[provider]}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-pd-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
