"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Crown,
  FileText,
  Layers,
  Scissors,
  Minimize2,
  Sparkles,
  Download,
  ArrowUpRight,
  Clock,
  Upload,
  TrendingUp,
  Zap,
  Brain,
  ChevronRight,
  Search,
  PenTool,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTranslation } from "@/i18n";
import { useAuthContext } from "@/components/providers/auth-provider";
import { DashboardMobileNav } from "@/components/dashboard/dashboard-layout";
import { ProRenewalBanner } from "@/components/dashboard/pro-renewal-banner";
import { Button, buttonVariants } from "@/components/ui/button";
import { slugToToolKey } from "@/lib/dashboard/tool-key";
import { ACTIVITY_UPDATED_EVENT } from "@/lib/client/activity-events";

const quickAccessTools = [
  { slug: "merge-pdf", icon: Layers, nameKey: "tools.mergePdf.name", color: "from-blue-500 to-indigo-600" },
  { slug: "split-pdf", icon: Scissors, nameKey: "tools.splitPdf.name", color: "from-sky-500 to-cyan-600" },
  { slug: "compress-pdf", icon: Minimize2, nameKey: "tools.compressPdf.name", color: "from-emerald-500 to-teal-600" },
  { slug: "pdf-to-word", icon: FileText, nameKey: "tools.pdfToWord.name", color: "from-violet-500 to-purple-600" },
  { slug: "sign-pdf", icon: PenTool, nameKey: "tools.signPdf.name", color: "from-rose-500 to-pink-600" },
  { slug: "ai-pdf-summarizer", icon: Sparkles, nameKey: "tools.aiPdfSummarizer.name", color: "from-amber-500 to-orange-600" },
  { slug: "protect-pdf", icon: Lock, nameKey: "tools.protectPdf.name", color: "from-slate-600 to-slate-800" },
  { slug: "word-to-pdf", icon: FileText, nameKey: "tools.wordToPdf.name", color: "from-blue-600 to-blue-800" },
];

type JobStatus = "completed" | "processing" | "failed";

interface JobRow {
  id: string;
  toolKey: string;
  fileName: string;
  date: string;
  status: JobStatus;
  downloadable: boolean;
  downloadUrl: string | null;
}

interface UsageStats {
  filesUsed: number;
  filesLimit: number;
  aiUsed: number;
  aiLimit: number;
  totalProcessed: number;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  progress,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  progress?: number;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-pd-border/70 bg-pd-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={cn("absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-10 blur-2xl", accent)} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-pd-muted">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-pd-foreground">
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-pd-muted">{sub}</p>}
        </div>
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
            accent
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {progress !== undefined && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-pd-border/60">
          <div
            className={cn("h-full rounded-full transition-all", accent)}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user, profile, isPro, refreshProfile } = useAuthContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats>({
    filesUsed: 0,
    filesLimit: 5,
    aiUsed: 0,
    aiLimit: 1,
    totalProcessed: 0,
  });
  const [search, setSearch] = useState("");

  const displayName =
    profile?.full_name?.trim() ||
    user?.email?.split("@")[0] ||
    "there";

  useEffect(() => {
    if (searchParams.get("upgraded") === "1") {
      setShowUpgradeSuccess(true);
      void refreshProfile();
      router.replace("/dashboard", { scroll: false });
    }
  }, [searchParams, refreshProfile, router]);

  useEffect(() => {
    async function loadJobs() {
      try {
        const res = await fetch("/api/user/files", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            console.warn("Dashboard files fetch failed:", res.status);
          }
          return;
        }
        const json = await res.json();
        const files = json.files as Array<{
          id: string;
          file_name: string;
          tool_slug?: string;
          tool: string;
          created_at: string;
          status: JobStatus;
          expired: boolean;
          download_url: string | null;
        }>;
        if (json.usage) {
          const u = json.usage as {
            files_used?: number;
            files_limit?: number;
            ai_used?: number;
            ai_limit?: number;
            total_processed?: number;
          };
          setUsageStats({
            filesUsed: u.files_used ?? 0,
            filesLimit: u.files_limit ?? 5,
            aiUsed: u.ai_used ?? 0,
            aiLimit: u.ai_limit ?? 1,
            totalProcessed: u.total_processed ?? 0,
          });
        }
        setJobs(
          (files ?? []).slice(0, 8).map((f) => ({
            id: f.id,
            toolKey: f.tool_slug ? slugToToolKey(f.tool_slug) : f.tool,
            fileName: f.file_name,
            date: new Date(f.created_at).toLocaleString(),
            status: f.status,
            downloadable: f.status === "completed" && !f.expired && !!f.download_url,
            downloadUrl: f.download_url,
          }))
        );
      } catch {
        /* keep empty state */
      }
    }

    const refreshDashboard = () => {
      void loadJobs();
      void refreshProfile();
    };

    refreshDashboard();
    const onFocus = () => refreshDashboard();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshDashboard();
    };
    const onActivityUpdated = () => refreshDashboard();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(ACTIVITY_UPDATED_EVENT, onActivityUpdated);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(ACTIVITY_UPDATED_EVENT, onActivityUpdated);
    };
  }, [refreshProfile]);

  const statusConfig: Record<JobStatus, { label: string; className: string }> = {
    completed: { label: t("dashboard.completed"), className: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/60" },
    processing: { label: t("dashboard.processing"), className: "bg-amber-100 text-amber-800 ring-1 ring-amber-200/60" },
    failed: { label: t("dashboard.failed"), className: "bg-red-100 text-red-700 ring-1 ring-red-200/60" },
  };

  const filesUsed = usageStats.filesUsed;
  const filesLimit = isPro ? 999 : usageStats.filesLimit;
  const aiUsed = usageStats.aiUsed;
  const aiLimit = isPro ? 50 : usageStats.aiLimit;
  const totalProcessed = usageStats.totalProcessed || profile?.total_files_processed || 0;

  const filteredJobs = jobs.filter(
    (j) =>
      !search.trim() ||
      j.fileName.toLowerCase().includes(search.toLowerCase()) ||
      t(j.toolKey).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <DashboardMobileNav />
      <ProRenewalBanner />

      {showUpgradeSuccess ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <strong>{t("dashboard.proActivatedTitle")}</strong> {t("dashboard.proActivatedDesc")}
        </div>
      ) : null}

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pd-brand via-indigo-600 to-violet-700 p-6 text-white shadow-lg shadow-indigo-500/20 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">{t("dashboard.overview")}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {t("dashboard.welcome", { name: displayName })}
            </h1>
            <p className="mt-2 max-w-lg text-sm text-white/85">
              {t("dashboard.uploadHint")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/merge-pdf">
              <Button
                size="lg"
                className="border-0 bg-white font-bold text-pd-brand shadow-md hover:bg-white/95"
              >
                <Upload className="h-5 w-5" />
                {t("dashboard.uploadPdf")}
              </Button>
            </Link>
            {!isPro && (
              <Link href="/dashboard/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/40 bg-white/10 font-bold text-white hover:bg-white/20"
                >
                  <Crown className="h-5 w-5" />
                  {t("dashboard.upgradeToPro")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dashboard.currentPlan")}
          value={isPro ? "Pro" : t("dashboard.freePlan")}
          sub={isPro ? t("dashboard.manageBilling") : t("dashboard.upgradeToPro")}
          icon={Crown}
          accent="bg-gradient-to-br from-amber-400 to-orange-500"
        />
        <StatCard
          label={t("dashboard.todaysUsage")}
          value={t("dashboard.filesProcessed", {
            used: String(filesUsed),
            total: String(filesLimit),
          })}
          icon={Zap}
          accent="bg-gradient-to-br from-blue-500 to-indigo-600"
          progress={(filesUsed / filesLimit) * 100}
        />
        <StatCard
          label={t("dashboard.aiSummaries")}
          value={t("dashboard.summariesUsed", {
            used: String(aiUsed),
            total: String(aiLimit),
          })}
          icon={Brain}
          accent="bg-gradient-to-br from-violet-500 to-purple-600"
          progress={(aiUsed / aiLimit) * 100}
        />
        <StatCard
          label={t("dashboard.totalFiles")}
          value={String(totalProcessed)}
          sub={t("dashboard.allTime")}
          icon={TrendingUp}
          accent="bg-gradient-to-br from-emerald-500 to-teal-600"
        />
      </section>

      {/* Quick access */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-pd-foreground">
            {t("dashboard.quickAccess")}
          </h2>
          <Link
            href="/#tools"
            className="inline-flex items-center gap-1 text-sm font-semibold text-pd-brand hover:text-pd-brand-hover"
          >
            {t("dashboard.browseTools")}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
          {quickAccessTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.slug}
                href={`/${tool.slug}`}
                className="group flex flex-col items-center gap-2.5 rounded-2xl border border-pd-border/70 bg-pd-surface p-4 text-center shadow-sm transition hover:-translate-y-1 hover:border-pd-brand/30 hover:shadow-md"
              >
                <span
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md transition group-hover:scale-105",
                    tool.color
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold leading-tight text-pd-foreground">
                  {t(tool.nameKey)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent jobs */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-pd-foreground">
              {t("dashboard.recentJobs")}
            </h2>
            <p className="text-sm text-pd-muted">{t("dashboard.recentJobsHint")}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pd-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("dashboard.searchFiles")}
                className="h-10 w-full rounded-xl border border-pd-border bg-pd-surface pl-9 pr-3 text-sm outline-none transition focus:border-pd-brand focus:ring-2 focus:ring-pd-brand/20 sm:w-56"
              />
            </div>
            <Link href="/dashboard/files">
              <Button variant="outline" size="sm" className="shrink-0 font-semibold">
                {t("dashboard.viewAllFiles")}
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-pd-border/70 bg-pd-surface shadow-sm">
          {filteredJobs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-pd-muted" />
              <p className="mt-3 font-semibold text-pd-foreground">
                {t("dashboard.noActivity")}
              </p>
              <p className="mt-1 text-sm text-pd-muted">
                {t("dashboard.noActivityDescription")}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="divide-y divide-pd-border/70 md:hidden">
                {filteredJobs.map((job) => {
                  const status = statusConfig[job.status];
                  return (
                    <div key={job.id} className="flex items-center gap-3 p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pd-brand-muted text-pd-brand">
                        <FileText className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-pd-foreground">
                          {job.fileName}
                        </p>
                        <p className="text-xs text-pd-muted">
                          {typeof job.toolKey === "string" && job.toolKey.startsWith("tools.")
                            ? t(job.toolKey)
                            : job.toolKey}{" "}
                          · {job.date}
                        </p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", status.className)}>
                        {status.label}
                      </span>
                      {job.downloadable && job.downloadUrl ? (
                        <a
                          href={job.downloadUrl}
                          download
                          aria-label={t("dashboard.download")}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "h-8 shrink-0 font-semibold text-pd-brand"
                          )}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-pd-border bg-pd-background/80">
                      <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-pd-muted">
                        {t("dashboard.tool")}
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-pd-muted">
                        {t("dashboard.fileName")}
                      </th>
                      <th className="hidden px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-pd-muted lg:table-cell">
                        {t("dashboard.date")}
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-pd-muted">
                        {t("dashboard.status")}
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-pd-muted">
                        {t("dashboard.action")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pd-border/60">
                    {filteredJobs.map((job) => {
                      const status = statusConfig[job.status];
                      return (
                        <tr
                          key={job.id}
                          className="transition-colors hover:bg-pd-background/50"
                        >
                          <td className="px-5 py-4 font-semibold text-pd-foreground">
                            {typeof job.toolKey === "string" && job.toolKey.startsWith("tools.")
                              ? t(job.toolKey)
                              : job.toolKey}
                          </td>
                          <td className="max-w-[220px] truncate px-5 py-4 text-pd-muted">
                            {job.fileName}
                          </td>
                          <td className="hidden px-5 py-4 text-pd-muted lg:table-cell">
                            {job.date}
                          </td>
                          <td className="px-5 py-4">
                            <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", status.className)}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {job.status === "completed" && job.downloadable && job.downloadUrl ? (
                              <a
                                href={job.downloadUrl}
                                download
                                className={cn(
                                  buttonVariants({ variant: "ghost", size: "sm" }),
                                  "h-8 font-semibold text-pd-brand"
                                )}
                              >
                                <Download className="h-4 w-4" />
                                {t("dashboard.download")}
                              </a>
                            ) : job.status === "completed" && !job.downloadable ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-pd-muted">
                                <Clock className="h-4 w-4" />
                                {t("dashboard.expired")}
                              </span>
                            ) : job.status === "processing" ? (
                              <span className="text-xs font-medium text-amber-700">
                                {t("dashboard.processing")}…
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
