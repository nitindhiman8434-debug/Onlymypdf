"use client";

import { useState, useEffect, type FormEvent, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { resolveRateLimitError } from "@/lib/rate-limit-message";
import { useTranslation } from "@/i18n";

const inputClass =
  "w-full rounded-xl border border-pd-border bg-pd-surface py-2.5 text-sm text-pd-foreground outline-none transition-colors focus:border-pd-brand focus:ring-2 focus:ring-pd-brand/20";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { language } = useTranslation();
  const [hashToken, setHashToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const tokenFromHash = new URLSearchParams(hash).get("token");
    if (tokenFromHash) {
      setHashToken(tokenFromHash);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const token = hashToken;

  useEffect(() => {
    if (token) {
      setSessionReady(true);
      setCheckingSession(false);
      return;
    }

    fetch("/api/auth/recovery-session")
      .then((res) => res.json())
      .then((data: { ready?: boolean }) => setSessionReady(Boolean(data.ready)))
      .catch(() => setSessionReady(false))
      .finally(() => setCheckingSession(false));
  }, [token]);

  const canReset = Boolean(token) || sessionReady;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token ?? undefined, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          resolveRateLimitError(
            data,
            res.status,
            language,
            data.error || "Could not reset password."
          )
        );
      }

      router.push("/login?message=password_updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return <div className="text-sm text-pd-muted">Loading...</div>;
  }

  if (!canReset) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-pd-muted">This reset link is invalid or has expired.</p>
        <Link
          href="/forgot-password"
          className={cn(buttonVariants({ variant: "default", size: "md" }))}
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-pd-foreground">
            New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pd-muted" aria-hidden="true" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-sm font-medium text-pd-foreground"
          >
            Confirm New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pd-muted" aria-hidden="true" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={cn(inputClass, "pl-10 pr-11")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              aria-pressed={showConfirmPassword}
              className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-pd-muted hover:bg-pd-background hover:text-pd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pd-brand"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Update Password
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Enter and confirm your new password below"
    >
      <div className="mb-6 hidden flex-col items-center gap-2 lg:flex">
        <Logo variant="icon" />
        <h1 className="text-xl font-bold text-pd-foreground">Choose a new password</h1>
        <p className="text-sm text-pd-muted">Enter and confirm your new password below</p>
      </div>

      <Suspense fallback={<div className="text-sm text-pd-muted">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>

      <p className="mt-6 text-center text-sm text-pd-muted">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-pd-brand hover:text-pd-brand-hover">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
