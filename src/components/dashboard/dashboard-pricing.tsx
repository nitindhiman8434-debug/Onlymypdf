"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  X,
  Crown,
  Zap,
  Shield,
  Clock,
  Headphones,
  CreditCard,
  BadgeCheck,
  ArrowRight,
  ChevronDown,
  Star,
  PenTool,
  Brain,
  Layers,
  IndianRupee,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { useAuthContext } from "@/components/providers/auth-provider";
import { PRO_PRICING, planFileSizeMarketingLabel } from "@/config/constants";
import { useProCheckout } from "@/hooks/use-pro-checkout";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { CurrencyToggle } from "@/components/pricing/currency-toggle";
import { DashboardMobileNav } from "@/components/dashboard/dashboard-layout";
import { DashboardBillingPanel } from "@/components/dashboard/dashboard-billing-panel";
import { MockBillingNotice } from "@/components/billing/mock-billing-notice";

const PRO_MONTHLY = PRO_PRICING.monthlyInr;
const PRO_YEARLY = PRO_PRICING.yearlyInr;

type CompareRow = {
  labelKey: string;
  free: string;
  pro: string;
  highlight?: boolean;
};

const COMPARE_SECTIONS: { titleKey: string; rows: CompareRow[] }[] = [
  {
    titleKey: "sectionUsage",
    rows: [
      { labelKey: "dailyUses", free: "daily5", pro: "daily100", highlight: true },
      { labelKey: "fileSize", free: "fileSizeFree", pro: "fileSizePro" },
      { labelKey: "batch", free: "no", pro: "yes" },
    ],
  },
  {
    titleKey: "sectionTools",
    rows: [
      { labelKey: "organize", free: "yes", pro: "yes" },
      { labelKey: "convert", free: "yes", pro: "yes" },
      { labelKey: "sign", free: "no", pro: "yes", highlight: true },
      { labelKey: "ai", free: "no", pro: "yes", highlight: true },
    ],
  },
  {
    titleKey: "sectionExperience",
    rows: [
      { labelKey: "speed", free: "standard", pro: "speedPriority" },
      { labelKey: "retention", free: "2hours", pro: "24hours" },
      { labelKey: "ads", free: "yes", pro: "no" },
      { labelKey: "support", free: "community", pro: "supportPriority" },
    ],
  },
];

const PRO_HIGHLIGHTS = [
  { icon: Brain, key: "highlight1" },
  { icon: PenTool, key: "highlight2" },
  { icon: Clock, key: "highlight3" },
  { icon: Headphones, key: "highlight4" },
] as const;

const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

function resolveCompareValue(key: string, t: (path: string) => string): string {
  if (key === "fileSizeFree") return planFileSizeMarketingLabel(false);
  if (key === "fileSizePro") return planFileSizeMarketingLabel(true);
  return t(`dashboard.pricing.val.${key}`);
}

const FREE_FEATURES = [
  "featMergeSplit",
  "featCompress",
  "featConvertBasic",
  "featDaily5",
  "featRetention2h",
] as const;

const PRO_FEATURES = [
  "featAllTools",
  "featSignAi",
  "featDaily100",
  "featPriority",
  "featRetention24h",
  "featNoAds",
  "featBatch",
  "featSupport",
] as const;

function CellValue({ value }: { value: string }) {
  if (value === "yes") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15">
        <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
        <X className="h-3.5 w-3.5 text-slate-400" strokeWidth={2.5} />
      </span>
    );
  }
  return <span className="text-sm font-semibold text-pd-foreground">{value}</span>;
}

function FaqAccordion({
  question,
  answer,
  defaultOpen,
}: {
  question: string;
  answer: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border transition-all duration-200",
        open
          ? "border-pd-brand/30 bg-white shadow-md shadow-pd-brand/5"
          : "border-pd-border/70 bg-pd-surface/80 hover:border-pd-brand/20"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="flex items-start gap-3">
          <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-pd-brand" aria-hidden />
          <span className="font-semibold text-pd-foreground">{question}</span>
        </span>
        <ChevronDown
          className={cn(
            "mt-1 h-5 w-5 shrink-0 text-pd-muted transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open && (
        <p className="border-t border-pd-border/60 px-5 pb-5 pl-[3.25rem] text-sm leading-relaxed text-pd-muted">
          {answer}
        </p>
      )}
    </div>
  );
}

export function DashboardPricingContent() {
  const { t } = useTranslation();
  const { user, profile, isPro } = useAuthContext();
  const { checkout, loading: checkoutLoading, error: checkoutError } = useProCheckout();
  const { currency, setCurrency, formatInr, isInr } = useDisplayCurrency();
  const [isYearly, setIsYearly] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [filesUsed, setFilesUsed] = useState(0);
  const [filesLimit, setFilesLimit] = useState(isPro ? 100 : 5);

  useEffect(() => {
    let cancelled = false;
    async function loadUsage() {
      try {
        const res = await fetch("/api/user/files", { cache: "no-store", credentials: "include" });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const usage = json.usage as { files_used?: number; files_limit?: number } | undefined;
        if (usage) {
          setFilesUsed(usage.files_used ?? 0);
          setFilesLimit(usage.files_limit ?? (isPro ? 100 : 5));
        }
      } catch {
        /* keep defaults */
      }
    }
    void loadUsage();
    return () => {
      cancelled = true;
    };
  }, [isPro]);

  const proPriceInr = isYearly ? PRO_YEARLY : PRO_MONTHLY;
  const monthlyEqInr = Math.round(PRO_YEARLY / 12);
  const proPriceDisplay = formatInr(proPriceInr);

  const renewDate = profile?.plan_expires_at
    ? new Date(profile.plan_expires_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  async function handleUpgrade() {
    if (!user) return;
    await checkout({
      duration: isYearly ? "yearly" : "monthly",
      userName: profile?.full_name ?? undefined,
      userEmail: user.email,
      couponCode: couponCode.trim() || undefined,
    });
  }

  return (
    <div className={cn("space-y-8 pb-8", !isPro && "pb-24 lg:pb-8")}>
      <DashboardMobileNav />

      {/* Hero — plan status + billing */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-5 text-white shadow-2xl shadow-indigo-950/30 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(99,102,241,0.35) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(139,92,246,0.25) 0%, transparent 45%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl"
        />
        <div className="relative space-y-3 sm:space-y-2.5">
          {/* Row 1 — eyebrow + billing toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/90 backdrop-blur-sm">
              <CreditCard className="h-3.5 w-3.5" aria-hidden />
              {t("dashboard.pricing.eyebrow")}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50 sm:text-xs">
                {t("dashboard.pricing.billingCycle")}
              </p>
              <div className="inline-flex rounded-xl border border-white/15 bg-white/10 p-0.5 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setIsYearly(false)}
                  className={cn(
                    "cursor-pointer rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200",
                    !isYearly
                      ? "bg-white text-indigo-900 shadow-lg"
                      : "text-white/70 hover:text-white"
                  )}
                >
                  {t("pricing.monthly")}
                </button>
                <button
                  type="button"
                  onClick={() => setIsYearly(true)}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200",
                    isYearly
                      ? "bg-white text-indigo-900 shadow-lg"
                      : "text-white/70 hover:text-white"
                  )}
                >
                  {t("pricing.yearly")}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-extrabold uppercase",
                      isYearly ? "bg-emerald-500 text-white" : "bg-emerald-400/30 text-emerald-200"
                    )}
                  >
                    -33%
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Row 2 — title full width, single line on desktop */}
          <h1 className="text-xl font-extrabold leading-tight tracking-tight sm:text-2xl lg:text-[1.75rem] lg:whitespace-nowrap xl:text-3xl">
            {t("dashboard.pricing.title")}
          </h1>

          {/* Row 3 — subtitle + current plan */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="max-w-2xl text-sm leading-snug text-white/75">
              {t("dashboard.pricing.subtitle")}
            </p>
            <div className="inline-flex shrink-0 items-center gap-2.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-md">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg shadow-lg",
                  isPro
                    ? "bg-gradient-to-br from-amber-400 to-orange-500"
                    : "bg-gradient-to-br from-emerald-400 to-teal-500"
                )}
              >
                {isPro ? (
                  <Crown className="h-4 w-4 text-white" aria-hidden />
                ) : (
                  <Zap className="h-4 w-4 text-white" aria-hidden />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-white/55">
                  {t("dashboard.pricing.yourPlan")}
                </p>
                <p className="text-sm font-bold leading-tight">
                  {isPro ? "Pro" : t("dashboard.freePlan")}
                  {isPro && renewDate && (
                    <span className="ml-1.5 text-xs font-normal text-white/55">
                      · {t("dashboard.renewsOn", { date: renewDate })}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <MockBillingNotice className="mt-4 max-w-2xl" />

          <CurrencyToggle
            value={currency}
            onChange={setCurrency}
            label={t("pricing.currencyLabel")}
            variant="dark"
            className="mt-4 items-start sm:items-start"
          />

          {isYearly && (
            <p className="text-right text-xs text-white/55">
              {t("dashboard.pricing.yearlyEquiv", { amount: monthlyEqInr.toLocaleString("en-IN") })}
            </p>
          )}

          {/* Usage bar for free users */}
          {!isPro && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white/90">
                  {t("dashboard.pricing.usageToday")}
                </p>
                <p className="text-xs text-white/60 sm:text-sm">
                  {t("dashboard.filesProcessed", {
                    used: String(filesUsed),
                    total: String(filesLimit),
                  })}
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (filesUsed / filesLimit) * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-white/50">{t("dashboard.pricing.usageHint")}</p>
            </div>
          )}
        </div>
      </section>

      {/* Plan cards */}
      <section className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        {/* Free */}
        <div
          className={cn(
            "relative flex flex-col overflow-hidden rounded-3xl border bg-white p-6 shadow-sm transition sm:p-7",
            !isPro
              ? "border-emerald-300/80 ring-2 ring-emerald-400/30 shadow-emerald-100/50"
              : "border-pd-border/70"
          )}
        >
          {!isPro && (
            <span className="absolute right-5 top-5 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              {t("dashboard.pricing.activePlan")}
            </span>
          )}
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-200/60">
              <Zap className="h-6 w-6 text-white" aria-hidden />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-pd-foreground">{t("dashboard.freePlan")}</h2>
              <p className="text-sm text-pd-muted">{t("dashboard.pricing.freeDesc")}</p>
            </div>
          </div>

          <div className="mt-6 flex items-end gap-1">
            <span className="text-5xl font-black tracking-tight text-pd-foreground">
              {formatInr(0)}
            </span>
            <span className="mb-1.5 text-pd-muted">{t("pricing.perMonth")}</span>
          </div>
          <p className="mt-1 text-xs font-medium text-emerald-600">{t("dashboard.pricing.noCard")}</p>

          <ul className="mt-6 flex-1 space-y-3">
            {FREE_FEATURES.map((key) => (
              <li key={key} className="flex items-start gap-3 text-sm text-pd-muted">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
                </span>
                {t(`dashboard.pricing.${key}`)}
              </li>
            ))}
          </ul>

          <Link href="/#tools" className="mt-7 block">
            <Button
              variant="outline"
              disabled={!isPro ? false : undefined}
              className={cn(
                "h-12 w-full rounded-2xl border-2 text-base font-bold",
                !isPro
                  ? "border-emerald-300 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-50"
                  : "border-pd-border"
              )}
            >
              {!isPro ? t("dashboard.pricing.currentPlanBtn") : t("pricing.getStarted")}
            </Button>
          </Link>
        </div>

        {/* Pro — premium dark card */}
        <div
          className={cn(
            "relative flex flex-col overflow-hidden rounded-3xl p-6 shadow-2xl sm:p-7",
            isPro
              ? "border-2 border-amber-400/50 bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 ring-2 ring-amber-400/20"
              : "border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950"
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/30 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl"
          />

          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30">
                  <Crown className="h-6 w-6 text-white" aria-hidden />
                </span>
                <div>
                  <h2 className="text-xl font-extrabold text-white">Pro</h2>
                  <p className="text-sm text-white/60">{t("dashboard.pricing.proDesc")}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-lg">
                {t("pricing.mostPopular")}
              </span>
            </div>

            <div className="mt-6 flex flex-wrap items-end gap-x-2 gap-y-1">
              <span className="text-5xl font-black tracking-tight text-white">
                {proPriceDisplay}
              </span>
              <span className="mb-1.5 text-white/60">
                {isYearly ? t("pricing.perYear") : t("pricing.perMonth")}
              </span>
            </div>
            {isYearly && (
              <p className="mt-1 text-sm font-medium text-amber-300/90">
                ≈ {formatInr(monthlyEqInr)}
                {t("pricing.perMonth")} · {t("dashboard.pricing.saveYearly")}
              </p>
            )}
            <p className="mt-1 text-xs text-white/45">
              {isInr
                ? t("dashboard.pricing.gst")
                : t("pricing.displayCurrencyNote", {
                    currency,
                    inrAmount: proPriceInr.toLocaleString("en-IN"),
                  })}
            </p>

            <ul className="mt-6 flex-1 space-y-3">
              {PRO_FEATURES.map((key) => (
                <li key={key} className="flex items-start gap-3 text-sm text-white/80">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                    <Check className="h-3 w-3 text-amber-300" strokeWidth={3} />
                  </span>
                  {t(`dashboard.pricing.${key}`)}
                </li>
              ))}
            </ul>

            <div className="mt-7 space-y-3">
              {!isPro ? (
                <div>
                  <label htmlFor="coupon-code" className="mb-1.5 block text-xs font-medium text-white/70">
                    {t("dashboard.pricing.couponLabel")}
                  </label>
                  <input
                    id="coupon-code"
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder={t("dashboard.pricing.couponPlaceholder")}
                    className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-amber-400/60"
                    autoComplete="off"
                  />
                </div>
              ) : null}
              {isPro ? (
                <Button
                  disabled
                  className="h-12 w-full rounded-2xl border border-amber-400/40 bg-amber-400/10 text-base font-bold text-amber-200"
                >
                  <BadgeCheck className="mr-2 h-5 w-5" />
                  {t("dashboard.pricing.currentPlanBtn")}
                </Button>
              ) : (
                <Button
                  className="h-12 w-full rounded-2xl border-0 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-base font-bold text-white shadow-xl shadow-orange-500/30 transition hover:shadow-2xl hover:shadow-orange-500/40"
                  loading={checkoutLoading}
                  onClick={() => void handleUpgrade()}
                >
                  {t("dashboard.pricing.upgradeNow")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              )}
            </div>
            {checkoutError ? (
              <p className="mt-2 text-center text-sm text-red-300" role="alert">
                {checkoutError}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {isPro && <DashboardBillingPanel />}

      {/* Pro highlights */}
      <section>
        <h2 className="text-lg font-bold text-pd-foreground">{t("dashboard.pricing.whyPro")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PRO_HIGHLIGHTS.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="group rounded-2xl border border-pd-border/70 bg-pd-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-pd-brand/25 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md transition group-hover:scale-105">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-3 font-bold text-pd-foreground">
                {t(`dashboard.pricing.${key}Title`)}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-pd-muted">
                {t(`dashboard.pricing.${key}Desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="overflow-hidden rounded-3xl border border-pd-border/70 bg-pd-surface shadow-sm">
        <div className="border-b border-pd-border/70 bg-gradient-to-r from-slate-50 to-indigo-50/50 px-6 py-5">
          <h2 className="text-lg font-bold text-pd-foreground">{t("dashboard.pricing.compareTitle")}</h2>
          <p className="mt-1 text-sm text-pd-muted">{t("dashboard.pricing.compareDesc")}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-pd-border/60">
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-pd-muted">
                  {t("pricing.features")}
                </th>
                <th className="px-4 py-4 text-center text-sm font-bold text-emerald-700">
                  {t("dashboard.freePlan")}
                </th>
                <th className="px-4 py-4 text-center text-sm font-bold text-indigo-600">Pro</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_SECTIONS.map((section) => (
                <Fragment key={section.titleKey}>
                  <tr className="bg-pd-brand-muted/40">
                    <td
                      colSpan={3}
                      className="px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider text-pd-brand"
                    >
                      {t(`dashboard.pricing.${section.titleKey}`)}
                    </td>
                  </tr>
                  {section.rows.map((row) => (
                    <tr
                      key={row.labelKey}
                      className={cn(
                        "border-b border-pd-border/40 transition hover:bg-slate-50/80",
                        row.highlight && "bg-amber-50/40"
                      )}
                    >
                      <td className="px-6 py-3.5 text-sm font-medium text-pd-foreground">
                        {t(`dashboard.pricing.row.${row.labelKey}`)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <CellValue
                          value={
                            ["yes", "no"].includes(row.free)
                              ? row.free
                              : resolveCompareValue(row.free, t)
                          }
                        />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <CellValue
                          value={
                            ["yes", "no"].includes(row.pro)
                              ? row.pro
                              : resolveCompareValue(row.pro, t)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Trust + payments */}
      <section>
        <div className="rounded-2xl border border-pd-border/70 bg-pd-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" aria-hidden />
            <h3 className="font-bold text-pd-foreground">{t("dashboard.pricing.trustTitle")}</h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(["trust1", "trust2", "trust3", "trust4"] as const).map((key) => (
              <div key={key} className="flex items-start gap-2.5 text-sm text-pd-muted">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.5} />
                {t(`dashboard.pricing.${key}`)}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="flex flex-wrap items-center justify-center gap-6 rounded-2xl border border-pd-border/60 bg-white/80 px-6 py-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {["A", "R", "P", "S"].map((l) => (
              <span
                key={l}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white"
              >
                {l}
              </span>
            ))}
          </div>
          <p className="text-sm font-semibold text-pd-foreground">{t("dashboard.pricing.social")}</p>
        </div>
        <div className="hidden h-8 w-px bg-pd-border sm:block" aria-hidden />
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
          ))}
          <span className="ml-1 text-sm font-semibold text-pd-foreground">Clear plan limits</span>
        </div>
        <div className="hidden h-8 w-px bg-pd-border sm:block" aria-hidden />
        <div className="flex items-center gap-2 text-sm text-pd-muted">
          <IndianRupee className="h-4 w-4 text-pd-brand" aria-hidden />
          {t("dashboard.pricing.payments")}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-lg font-bold text-pd-foreground">{t("dashboard.pricing.faqTitle")}</h2>
        <p className="mt-1 text-sm text-pd-muted">{t("dashboard.pricing.faqDesc")}</p>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {FAQ_KEYS.map((key, i) => (
            <FaqAccordion
              key={key}
              question={t(`dashboard.pricing.faq.${key}`)}
              answer={t(`dashboard.pricing.faq.a${key.slice(1)}`)}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      {!isPro && (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 p-6 text-center text-white shadow-xl sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-white/10 blur-2xl"
          />
          <Layers className="mx-auto h-10 w-10 text-white/80" aria-hidden />
          <h2 className="mt-3 text-xl font-bold sm:text-2xl">{t("dashboard.pricing.ctaTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/80">{t("dashboard.pricing.ctaDesc")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              className="rounded-2xl bg-white px-8 font-bold text-indigo-700 shadow-lg hover:bg-white/95"
              loading={checkoutLoading}
              onClick={() => void handleUpgrade()}
            >
              <Crown className="mr-2 h-5 w-5" />
              {t("dashboard.pricing.upgradeNow")}
            </Button>
            <Link href="/contact">
              <Button
                size="lg"
                variant="outline"
                className="rounded-2xl border-white/40 bg-transparent font-bold text-white hover:bg-white/10"
              >
                {t("dashboard.helpSupport")}
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* Sticky mobile CTA */}
      {!isPro && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-pd-border/80 bg-white/95 p-3 shadow-[0_-8px_30px_-8px_rgba(0,0,0,0.12)] backdrop-blur-md lg:hidden">
          <Button
            className="h-12 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-base font-bold shadow-lg"
            loading={checkoutLoading}
            onClick={() => void handleUpgrade()}
          >
            {t("dashboard.pricing.upgradeNow")} · {proPriceDisplay}
          </Button>
        </div>
      )}
    </div>
  );
}
