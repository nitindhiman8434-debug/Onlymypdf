"use client";

import { Suspense, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { useTranslation } from "@/i18n";
import { resolveSafeNextPath } from "@/lib/auth/safe-redirect";
import { TurnstileWidget, getTurnstileSiteKey } from "@/components/security/turnstile-widget";

const inputClass =
  "w-full rounded-xl border border-pd-border bg-pd-surface py-2.5 text-sm text-pd-foreground outline-none transition-colors focus:border-pd-brand focus:ring-2 focus:ring-pd-brand/20";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);
  const turnstileSiteKey = getTurnstileSiteKey();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = resolveSafeNextPath(searchParams.get("redirect"), "/dashboard");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      passwordRef.current?.focus();
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      confirmPasswordRef.current?.focus();
      return;
    }

    if (!agreeTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      termsRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName,
          email,
          password,
          termsAccepted: true,
          ...(turnstileSiteKey ? { turnstileToken } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Signup failed.");
      }

      if (data.needsEmailConfirmation) {
        router.push("/login?message=signup_confirm");
        return;
      }

      window.location.assign(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={t("auth.signupTitle")} subtitle={t("auth.signupSubtitle")}>
      <div className="mb-6 hidden flex-col items-center gap-2 lg:flex">
        <Logo variant="icon" />
        <h1 className="text-xl font-bold text-pd-foreground">{t("auth.signupTitle")}</h1>
        <p className="text-sm text-pd-muted">{t("auth.signupSubtitle")}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-pd-foreground">
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pd-muted" aria-hidden="true" />
            <input
              id="fullName"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className={cn(inputClass, "pl-10 pr-4")}
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-pd-foreground">
            Email
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
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pd-muted" aria-hidden="true" />
            <input
              ref={passwordRef}
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
          <p className="mt-1.5 text-xs text-pd-muted">Must be at least 8 characters</p>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-sm font-medium text-pd-foreground"
          >
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pd-muted" aria-hidden="true" />
            <input
              ref={confirmPasswordRef}
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

        <label className="flex items-start gap-2.5 pt-1">
          <input
            ref={termsRef}
            name="termsAccepted"
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-pd-border text-pd-brand focus:ring-pd-brand/20"
          />
          <span className="text-sm text-pd-muted">
            I agree to the{" "}
            <Link href="/terms" className="text-pd-brand hover:text-pd-brand-hover">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-pd-brand hover:text-pd-brand-hover">
              Privacy Policy
            </Link>
          </span>
        </label>

        <Button
          type="submit"
          disabled={loading || (turnstileSiteKey ? !turnstileToken : false)}
          className="w-full"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t("auth.signupButton")}
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

      <p className="mt-6 text-center text-sm text-pd-muted">
        {t("auth.hasAccount")}{" "}
        <Link href="/login" className="font-semibold text-pd-brand hover:text-pd-brand-hover">
          {t("auth.loginLink")}
        </Link>
      </p>
    </AuthShell>
  );
}
