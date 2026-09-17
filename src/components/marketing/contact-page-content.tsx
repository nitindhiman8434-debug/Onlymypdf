"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Send, Mail, Clock, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { MarketingPageShell } from "@/components/layout/marketing-page-shell";
import { SUPPORT_EMAIL } from "@/config/constants";
import { useTranslation } from "@/i18n";
import {
  getContactFieldErrors,
  type ContactFieldErrors,
} from "@/lib/validation/contact-validation";
import { TurnstileWidget, getTurnstileSiteKey } from "@/components/security/turnstile-widget";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-pd-border bg-pd-surface px-4 py-2.5 text-sm text-pd-foreground placeholder:text-pd-muted focus:border-pd-brand focus:outline-none focus:ring-2 focus:ring-pd-brand/20";

export function ContactPageContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "General",
    message: "",
  });
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileSiteKey = getTurnstileSiteKey();

  useEffect(() => {
    const subjectParam = searchParams.get("subject")?.toLowerCase();
    if (subjectParam === "business" || subjectParam === "sales") {
      setFormData((prev) => ({
        ...prev,
        subject: "Business / Sales",
        message: prev.message || "I'm interested in the Business plan for my team.",
      }));
    }
  }, [searchParams]);

  function validate() {
    const fieldErrors = getContactFieldErrors(formData);
    const translated: ContactFieldErrors = {};
    for (const [key, errorKey] of Object.entries(fieldErrors)) {
      if (errorKey) {
        translated[key as keyof ContactFieldErrors] = t(errorKey);
      }
    }
    return translated;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSubmitError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          ...(turnstileSiteKey ? { turnstileToken } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t("errors.generic"));
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : t("errors.generic")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MarketingPageShell
      title="Contact Us"
      description="Have a question, feedback, or need help? We'd love to hear from you."
      eyebrow="Support"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]}
    >
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {submitted ? (
            <div className="rounded-2xl border border-pd-success/30 bg-pd-brand-muted p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pd-brand-muted">
                <Send className="h-6 w-6 text-pd-brand" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-pd-foreground">Message Sent!</h2>
              <p className="mt-2 text-sm text-pd-muted">
                Thank you for reaching out. We&apos;ll get back to you within 24-48 hours.
              </p>
              <Button
                className="mt-6"
                onClick={() => {
                  setSubmitted(false);
                  setFormData({ name: "", email: "", subject: "General", message: "" });
                }}
              >
                Send Another Message
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-pd-border bg-pd-surface p-6 shadow-sm sm:p-8"
            >
              <div className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-pd-foreground">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputClass}
                    placeholder="Your name"
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-pd-danger" role="alert">
                      {errors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-pd-foreground">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={inputClass}
                    placeholder="your@email.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-pd-danger" role="alert">
                      {errors.email}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-pd-foreground">
                    Subject
                  </label>
                  <select
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className={inputClass}
                  >
                    <option value="General">General</option>
                    <option value="Business / Sales">Business / Sales</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Billing">Billing</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.subject && (
                    <p className="mt-1 text-xs text-pd-danger" role="alert">
                      {errors.subject}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-pd-foreground">
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className={cn(inputClass, "resize-none")}
                    placeholder="Tell us how we can help..."
                  />
                  {errors.message && (
                    <p className="mt-1 text-xs text-pd-danger" role="alert">
                      {errors.message}
                    </p>
                  )}
                </div>
                {submitError ? (
                  <p className="text-sm text-pd-danger" role="alert">
                    {submitError}
                  </p>
                ) : null}
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
                  disabled={submitting || (turnstileSiteKey ? !turnstileToken : false)}
                >
                  <Send className="h-4 w-4" />
                  {submitting ? "Sending…" : "Send Message"}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="space-y-4">
          {[
            {
              icon: Mail,
              title: "Email Us",
              body: (
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm text-pd-brand hover:underline">
                  {SUPPORT_EMAIL}
                </a>
              ),
            },
            {
              icon: Clock,
              title: "Response Time",
              body: <p className="text-sm text-pd-muted">We typically respond within 24-48 hours.</p>,
            },
            {
              icon: HelpCircle,
              title: "Quick Answers",
              body: (
                <>
                  <p className="text-sm text-pd-muted">Check our FAQ for quick answers to common questions.</p>
                  <Link href="/faq" className="mt-3 inline-flex text-sm font-medium text-pd-brand">
                    Visit FAQ →
                  </Link>
                </>
              ),
            },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border border-pd-border bg-pd-surface p-6 shadow-sm">
              <card.icon className="h-6 w-6 text-pd-brand" />
              <h3 className="mt-3 font-semibold text-pd-foreground">{card.title}</h3>
              <div className="mt-1">{card.body}</div>
            </div>
          ))}
        </div>
      </div>
    </MarketingPageShell>
  );
}
