"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, ShieldCheck, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";

import { TurnstileWidget, getTurnstileSiteKey } from "@/components/security/turnstile-widget";

type Step = "email" | "verify" | "done";

const inputClass =
  "w-full rounded-xl border border-pd-border bg-pd-surface py-2.5 text-sm text-pd-foreground outline-none transition-colors focus:border-pd-brand focus:ring-2 focus:ring-pd-brand/20";

const stepSubtitles: Record<Step, string> = {
  email: "Enter your email to receive a verification code",
  verify: "Enter the 6-digit code sent to your email",
  done: "Continue to set your new password",
};

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileSiteKey = getTurnstileSiteKey();
  const router = useRouter();

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          ...(turnstileSiteKey ? { turnstileToken } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Could not send verification code.");
      }

      if (data.mode === "supabase") {
        setStep("done");
        setResetUrl("");
        return;
      }

      if (data.devCode) {
        setDevCode(data.devCode);
      }

      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Invalid verification code.");
      }

      setResetUrl(data.resetUrl || "");
      setResetToken(data.resetToken || "");
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset password" subtitle={stepSubtitles[step]}>
      <div className="mb-6 hidden flex-col items-center gap-2 lg:flex">
        <Logo variant="icon" />
        <h1 className="text-xl font-bold text-pd-foreground">Reset password</h1>
        <p className="text-sm text-pd-muted">{stepSubtitles[step]}</p>
      </div>

      <div className="mb-6 flex items-center justify-center gap-2 text-xs font-medium text-pd-muted">
        <span className={cn(step === "email" && "text-pd-brand")}>1. Email</span>
        <ArrowRight className="h-3 w-3" />
        <span className={cn(step === "verify" && "text-pd-brand")}>2. Verify</span>
        <ArrowRight className="h-3 w-3" />
        <span className={cn(step === "done" && "text-pd-brand")}>3. Reset</span>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
          {error}
        </div>
      )}

      {devCode && step === "verify" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Development mode: your verification code is{" "}
          <span className="font-bold tracking-widest">{devCode}</span>
        </div>
      )}

      {step === "email" && (
        <form onSubmit={handleSendCode} className="space-y-4">
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

          {turnstileSiteKey ? (
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onToken={setTurnstileToken}
              onExpire={() => setTurnstileToken("")}
              className="flex justify-center"
            />
          ) : null}

          <Button
            type="submit"
            disabled={loading || (turnstileSiteKey ? !turnstileToken : false)}
            className="w-full"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Send Verification Code
          </Button>
        </form>
      )}

      {step === "verify" && (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-pd-foreground">
              Verification Code
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pd-muted" aria-hidden="true" />
              <input
                id="code"
                name="one-time-code"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className={cn(inputClass, "pl-10 pr-4 tracking-[0.3em]")}
              />
            </div>
            <p className="mt-1.5 text-xs text-pd-muted">Code sent to {email}</p>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify Code
          </Button>

          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setDevCode("");
            }}
            className="w-full text-sm text-pd-muted hover:text-pd-foreground"
          >
            Use a different email
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {resetUrl
              ? "Verification successful. Open your password reset link to continue."
              : "If an account exists for this email, a reset link has been sent. Check your inbox."}
          </div>

          {resetUrl ? (
            <Button
              type="button"
              className="w-full"
              onClick={() =>
                router.push(
                  resetToken
                    ? `/reset-password#token=${encodeURIComponent(resetToken)}`
                    : resetUrl.replace(window.location.origin, "")
                )
              }
            >
              Open Reset Link
            </Button>
          ) : null}

          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "secondary", size: "md" }), "w-full")}
          >
            Back to Login
          </Link>
        </div>
      )}

      {step !== "done" && (
        <p className="mt-6 text-center text-sm text-pd-muted">
          Remember your password?{" "}
          <Link href="/login" className="font-medium text-pd-brand hover:text-pd-brand-hover">
            Log in
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
