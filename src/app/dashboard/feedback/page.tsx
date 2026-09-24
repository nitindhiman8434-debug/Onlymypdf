"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, MessageSquareHeart, ShieldCheck, Trash2 } from "lucide-react";
import { DashboardMobileNav } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

type FeedbackJob = {
  id: string;
  tool_name: string;
  created_at: string;
  completed_at?: string | null;
};

type FeedbackRecord = {
  id: string;
  tool_job_id: string;
  tool_name: string;
  overall_rating: number;
  accuracy_rating: number;
  speed_rating: number;
  comment: string;
  publish_consent: boolean;
  status: "pending" | "published" | "rejected";
  created_at: string;
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-pd-border bg-pd-surface px-4 py-2.5 text-sm text-pd-foreground focus:border-pd-brand focus:outline-none focus:ring-2 focus:ring-pd-brand/20";

function toolLabel(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function DashboardFeedbackPage() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<FeedbackJob[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    jobId: "",
    overallRating: "5",
    accuracyRating: "5",
    speedRating: "5",
    comment: "",
    researchConsent: false,
    publishConsent: false,
  });

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t("feedbackPage.loadError"));
      const nextJobs = (data.jobs ?? []) as FeedbackJob[];
      setJobs(nextJobs);
      setFeedback((data.feedback ?? []) as FeedbackRecord[]);
      setForm((current) => ({
        ...current,
        jobId: nextJobs.some((job) => job.id === current.jobId)
          ? current.jobId
          : (nextJobs[0]?.id ?? ""),
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("feedbackPage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  async function submitFeedback(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: form.jobId,
          overallRating: Number(form.overallRating),
          accuracyRating: Number(form.accuracyRating),
          speedRating: Number(form.speedRating),
          comment: form.comment,
          researchConsent: form.researchConsent,
          publishConsent: form.publishConsent,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t("feedbackPage.saveError"));
      setMessage(t("feedbackPage.saved"));
      setForm((current) => ({
        ...current,
        comment: "",
        researchConsent: false,
        publishConsent: false,
      }));
      await loadFeedback();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t("feedbackPage.saveError")
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function withdrawFeedback(feedbackId: string) {
    if (!window.confirm(t("feedbackPage.withdrawConfirm"))) return;
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t("feedbackPage.withdrawError"));
      setMessage(t("feedbackPage.withdrawn"));
      await loadFeedback();
    } catch (withdrawError) {
      setError(
        withdrawError instanceof Error
          ? withdrawError.message
          : t("feedbackPage.withdrawError")
      );
    }
  }

  const ratingOptions = [5, 4, 3, 2, 1];

  return (
    <div className="pd-dashboard-content mx-auto max-w-4xl">
      <DashboardMobileNav />

      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-pd-muted hover:text-pd-brand"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("dashboard.backToOverview")}
      </Link>

      <header className="mb-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pd-brand-muted text-pd-brand">
            <MessageSquareHeart className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-pd-foreground">{t("feedbackPage.title")}</h1>
            <p className="mt-1 text-sm leading-relaxed text-pd-muted">
              {t("feedbackPage.subtitle")}
            </p>
          </div>
        </div>
      </header>

      {message ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-pd-border/80 bg-pd-surface p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          <div>
            <h2 className="text-sm font-bold text-emerald-900">{t("feedbackPage.verifiedTitle")}</h2>
            <p className="mt-1 text-xs leading-relaxed text-emerald-800">
              {t("feedbackPage.verifiedDescription")}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-pd-muted" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t("feedbackPage.loading")}
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-pd-brand" aria-hidden />
            <h2 className="mt-3 text-lg font-bold text-pd-foreground">{t("feedbackPage.noJobsTitle")}</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-pd-muted">
              {t("feedbackPage.noJobsDescription")}
            </p>
            <Link href="/#tools" className="mt-5 inline-flex text-sm font-semibold text-pd-brand hover:underline">
              {t("feedbackPage.useTool")}
            </Link>
          </div>
        ) : (
          <form onSubmit={submitFeedback} className="mt-6 space-y-5">
            <div>
              <label htmlFor="feedback-job" className="text-sm font-semibold text-pd-foreground">
                {t("feedbackPage.conversionLabel")}
              </label>
              <select
                id="feedback-job"
                value={form.jobId}
                onChange={(event) => setForm({ ...form, jobId: event.target.value })}
                className={inputClass}
                required
              >
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {toolLabel(job.tool_name)} · {new Date(job.completed_at ?? job.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {([
                ["overallRating", "feedbackPage.overallLabel"],
                ["accuracyRating", "feedbackPage.accuracyLabel"],
                ["speedRating", "feedbackPage.speedLabel"],
              ] as const).map(([field, labelKey]) => (
                <div key={field}>
                  <label htmlFor={`feedback-${field}`} className="text-sm font-semibold text-pd-foreground">
                    {t(labelKey)}
                  </label>
                  <select
                    id={`feedback-${field}`}
                    value={form[field]}
                    onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                    className={inputClass}
                  >
                    {ratingOptions.map((rating) => (
                      <option key={rating} value={rating}>
                        {rating} / 5
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div>
              <label htmlFor="feedback-comment" className="text-sm font-semibold text-pd-foreground">
                {t("feedbackPage.commentLabel")}
              </label>
              <textarea
                id="feedback-comment"
                value={form.comment}
                onChange={(event) => setForm({ ...form, comment: event.target.value })}
                className={`${inputClass} min-h-32 resize-y`}
                minLength={20}
                maxLength={2000}
                required
                placeholder={t("feedbackPage.commentPlaceholder")}
              />
              <p className="mt-1 text-xs text-pd-muted">{form.comment.length}/2000</p>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-pd-border bg-pd-background p-4 text-sm text-pd-foreground">
              <input
                type="checkbox"
                checked={form.researchConsent}
                onChange={(event) => setForm({ ...form, researchConsent: event.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-pd-border text-pd-brand focus:ring-pd-brand"
                required
              />
              <span>{t("feedbackPage.storageConsent")}</span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-pd-border bg-pd-background p-4 text-sm text-pd-foreground">
              <input
                type="checkbox"
                checked={form.publishConsent}
                onChange={(event) => setForm({ ...form, publishConsent: event.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-pd-border text-pd-brand focus:ring-pd-brand"
              />
              <span>{t("feedbackPage.publishConsent")}</span>
            </label>

            <Button type="submit" disabled={submitting || !form.jobId || !form.researchConsent}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("feedbackPage.submit")}
            </Button>
          </form>
        )}
      </section>

      {feedback.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-pd-border/80 bg-pd-surface p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-pd-foreground">{t("feedbackPage.historyTitle")}</h2>
          <div className="mt-4 space-y-4">
            {feedback.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-pd-border bg-pd-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-pd-foreground">{toolLabel(entry.tool_name)}</h3>
                    <p className="mt-1 text-xs text-pd-muted">
                      {new Date(entry.created_at).toLocaleDateString()} · {entry.overall_rating}/5 · {entry.status}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => void withdrawFeedback(entry.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {t("feedbackPage.withdraw")}
                  </Button>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-pd-muted">{entry.comment}</p>
                <p className="mt-2 text-xs text-pd-muted">
                  {entry.publish_consent
                    ? t("feedbackPage.publicationAllowed")
                    : t("feedbackPage.publicationPrivate")}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
