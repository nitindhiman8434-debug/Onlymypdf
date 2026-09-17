"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Check,
  X,
  ChevronRight,
  Zap,
  Crown,
  Shield,
  Lock,
  Timer,
  CreditCard,
  Users,
  Sparkles,
  Building2,
  KeyRound,
  Headphones,
  BadgeCheck,
  ArrowRight,
  Minus,
  IndianRupee,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { useAuthContext } from "@/components/providers/auth-provider";
import { PRO_PRICING, planFileSizeMarketingLabel, FILE_LIMITS } from "@/config/constants";
import { useProCheckout } from "@/hooks/use-pro-checkout";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { CurrencyToggle } from "@/components/pricing/currency-toggle";
import { FREE_FEATURES, PRO_FEATURES } from "@/components/marketing/home/home-shared";
import { MockBillingNotice } from "@/components/billing/mock-billing-notice";

const PRO_MONTHLY = PRO_PRICING.monthlyInr;
const PRO_YEARLY = PRO_PRICING.yearlyInr;

type CompareValue = "yes" | "no" | "text";

interface CompareRow {
  labelKey: string;
  free: CompareValue;
  pro: CompareValue;
  business: CompareValue;
  freeTextKey?: string;
  proTextKey?: string;
  businessTextKey?: string;
}

const COMPARE_ROWS: CompareRow[] = [
  { labelKey: "dailyUses", free: "text", pro: "text", business: "text", freeTextKey: "dailyUsesFree", proTextKey: "dailyUsesPro", businessTextKey: "dailyUsesBusiness" },
  { labelKey: "fileSize", free: "text", pro: "text", business: "text", freeTextKey: "fileSizeFree", proTextKey: "fileSizePro", businessTextKey: "fileSizeBusiness" },
  { labelKey: "basicTools", free: "yes", pro: "yes", business: "yes" },
  { labelKey: "convertTools", free: "yes", pro: "yes", business: "yes" },
  { labelKey: "signPdf", free: "no", pro: "yes", business: "yes" },
  { labelKey: "aiSummarizer", free: "no", pro: "yes", business: "yes" },
  { labelKey: "batchProcessing", free: "no", pro: "yes", business: "yes" },
  { labelKey: "teamSeats", free: "no", pro: "no", business: "text", businessTextKey: "teamSeatsBusiness" },
  { labelKey: "apiAccess", free: "no", pro: "no", business: "yes" },
  { labelKey: "processingSpeed", free: "text", pro: "text", business: "text", freeTextKey: "speedStandard", proTextKey: "speedPriority", businessTextKey: "speedDedicated" },
  { labelKey: "fileRetention", free: "text", pro: "text", business: "text", freeTextKey: "retention2h", proTextKey: "retention24h", businessTextKey: "retentionBusiness" },
  { labelKey: "dashboardHistory", free: "yes", pro: "yes", business: "yes" },
  { labelKey: "ads", free: "text", pro: "text", business: "text", freeTextKey: "adsYes", proTextKey: "adsNo", businessTextKey: "adsNo" },
  { labelKey: "support", free: "text", pro: "text", business: "text", freeTextKey: "supportCommunity", proTextKey: "supportPriority", businessTextKey: "supportDedicated" },
];

const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"] as const;

const TRUST_PILLS = [
  { icon: Users, key: "trustUsers" },
  { icon: Shield, key: "trustSecure" },
  { icon: BadgeCheck, key: "trustNoHidden" },
] as const;

const TRUST_STRIP = [
  { icon: Lock, key: "stripEncrypt" },
  { icon: Timer, key: "stripAutoDelete" },
  { icon: CreditCard, key: "stripPayments" },
  { icon: RefreshCw, key: "stripCancel" },
] as const;

const BENEFIT_KEYS = ["benefit1", "benefit2", "benefit3", "benefit4"] as const;

function CompareCell({
  value,
  text,
}: {
  value: CompareValue;
  text?: string;
}) {
  if (value === "yes") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
        <Check className="h-4 w-4 text-emerald-600" aria-hidden />
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
        <X className="h-4 w-4 text-slate-600" aria-hidden />
      </span>
    );
  }
  return (
    <span className="text-sm font-medium text-pd-foreground">{text ?? "—"}</span>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-2xl border border-pd-border/80 bg-white/80 backdrop-blur-sm transition hover:border-pd-brand/25 hover:shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-pd-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex items-start gap-3">
          <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-pd-brand" aria-hidden />
          {question}
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pd-brand-muted text-lg font-light text-pd-brand transition group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="border-t border-pd-border/60 px-5 pb-5 pt-4 text-sm leading-relaxed text-pd-muted">
        {answer}
      </p>
    </details>
  );
}

function PlanFeatureList({
  items,
  variant,
}: {
  items: string[];
  variant: "free" | "pro" | "business";
}) {
  const checkClass =
    variant === "free"
      ? "bg-emerald-100 text-emerald-700"
      : variant === "pro"
        ? "bg-blue-100 text-blue-700"
        : "bg-violet-100 text-violet-700";

  return (
    <ul className="w-full space-y-2.5">
      {items.map((f) => (
        <li key={f} className="flex w-full items-start gap-3 text-[15px] font-medium leading-snug text-slate-800">
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              checkClass
            )}
          >
            <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">{f}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanCardShell({
  variant,
  children,
  footer,
}: {
  variant: "free" | "pro" | "business";
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-white transition-all duration-300 hover:-translate-y-0.5",
        variant === "free" &&
          "border-slate-200/90 shadow-sm hover:border-emerald-200/80 hover:shadow-md",
        variant === "pro" &&
          "border-pd-brand/40 shadow-lg shadow-blue-500/10 ring-1 ring-pd-brand/15 hover:shadow-xl hover:shadow-blue-500/15",
        variant === "business" &&
          "border-slate-300/90 shadow-md hover:border-violet-200/80 hover:shadow-lg"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 rounded-2xl",
          variant === "free" && "bg-gradient-to-br from-emerald-50/40 via-white to-slate-50/30",
          variant === "pro" && "bg-gradient-to-br from-blue-50/70 via-indigo-50/25 to-white",
          variant === "business" && "bg-gradient-to-br from-slate-50/80 via-violet-50/20 to-white"
        )}
        aria-hidden
      />
      <div className="relative flex flex-col p-4 sm:p-5">
        {children}
        <div className="mt-5 border-t border-slate-100/90 pt-4">{footer}</div>
      </div>
    </div>
  );
}

export function PricingPageContent() {
  const { t } = useTranslation();
  const { user, profile, isPro, loading: authLoading } = useAuthContext();
  const { checkout, loading: checkoutLoading, error: checkoutError } = useProCheckout();
  const { currency, setCurrency, formatInr, isInr } = useDisplayCurrency();
  const [isYearly, setIsYearly] = useState(false);

  const proPriceInr = isYearly ? PRO_YEARLY : PRO_MONTHLY;
  const proPeriod = isYearly ? t("pricing.perYear") : t("pricing.perMonth");
  const monthlyEquivalentInr = isYearly ? Math.round(PRO_YEARLY / 12) : null;
  const proPriceDisplay = formatInr(proPriceInr);

  const freeCtaHref = user ? "/#tools" : "/signup";

  async function handleProUpgrade() {
    if (!user) {
      window.location.href = `/signup?redirect=${encodeURIComponent("/dashboard/pricing")}`;
      return;
    }
    await checkout({
      duration: isYearly ? "yearly" : "monthly",
      userName: profile?.full_name ?? undefined,
      userEmail: user.email,
    });
  }

  return (
    <article className="pd-marketing-page bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_35%,#f8fafc_100%)]">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="border-b border-pd-border/80 bg-white/70 py-2 backdrop-blur-sm">
        <div className="pd-container">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-pd-muted">
            <li className="flex items-center gap-1">
              <Link href="/" className="transition hover:text-pd-brand">
                {t("pricing.page.breadcrumbHome")}
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <span className="font-medium text-pd-foreground">{t("pricing.page.breadcrumbPricing")}</span>
            </li>
          </ol>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-pd-border/60 py-8 sm:py-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-pd-brand/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl"
        />
        <div className="pd-container relative max-w-4xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-pd-brand/20 bg-pd-brand-muted/80 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-pd-brand">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t("pricing.page.eyebrow")}
          </p>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-pd-foreground sm:text-4xl lg:text-5xl">
            {t("pricing.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-pd-muted sm:text-lg">
            {t("pricing.page.heroDesc")}
          </p>

          <MockBillingNotice className="mx-auto mt-6 max-w-xl text-left" />

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {TRUST_PILLS.map(({ icon: Icon, key }) => (
              <span
                key={key}
                className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm"
              >
                <Icon className="h-4 w-4 text-pd-brand" aria-hidden />
                {t(`pricing.page.${key}`)}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-pd-border/60 bg-white/60 py-4 backdrop-blur-sm">
        <div className="pd-container">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {TRUST_STRIP.map(({ icon: Icon, key }) => (
              <div
                key={key}
                className="flex items-center gap-2.5 rounded-xl border border-pd-border/60 bg-white/80 px-3 py-2.5 sm:px-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pd-brand-muted">
                  <Icon className="h-4 w-4 text-pd-brand" aria-hidden />
                </div>
                <p className="text-xs font-semibold leading-snug text-pd-foreground sm:text-[13px]">
                  {t(`pricing.page.${key}`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="pd-container max-w-6xl pb-16 pt-8">
        {/* Billing + display currency toggles */}
        <div className="flex flex-col items-center gap-4">
          <div className="inline-flex items-center rounded-full border border-pd-border bg-white/90 p-1 shadow-sm backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200",
                !isYearly
                  ? "bg-pd-brand text-white shadow-md shadow-pd-brand/25"
                  : "text-pd-muted hover:text-pd-foreground"
              )}
            >
              {t("pricing.monthly")}
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={cn(
                "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200",
                isYearly
                  ? "bg-pd-brand text-white shadow-md shadow-pd-brand/25"
                  : "text-pd-muted hover:text-pd-foreground"
              )}
            >
              {t("pricing.yearly")}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  isYearly ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"
                )}
              >
                {t("pricing.yearlyDiscount")}
              </span>
            </button>
          </div>

          <CurrencyToggle
            value={currency}
            onChange={setCurrency}
            label={t("pricing.currencyLabel")}
          />
        </div>

        {isYearly && monthlyEquivalentInr ? (
          <p className="mt-3 text-center text-sm text-pd-muted">
            {isInr
              ? t("pricing.page.yearlyNote", {
                  amount: monthlyEquivalentInr.toLocaleString("en-IN"),
                })
              : t("pricing.displayYearlyNote", {
                  amount: `${formatInr(monthlyEquivalentInr)}${t("pricing.perMonth")}`,
                })}
          </p>
        ) : null}

        {/* Pricing cards — Free · Pro · Business */}
        <div className="mx-auto mt-8 grid max-w-lg gap-5 sm:max-w-none sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          <PlanCardShell
            variant="free"
            footer={
              <>
                {!authLoading && user && !isPro ? (
                  <div className="mb-2.5 flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    {t("pricing.currentPlan")}
                  </div>
                ) : null}
                <Link href={freeCtaHref} className="block">
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-xl border-2 text-sm font-bold transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    {t("pricing.getStarted")}
                  </Button>
                </Link>
              </>
            }
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-200/40">
                <Zap className="h-5 w-5 text-white" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-pd-foreground">{t("pricing.page.freeName")}</h2>
                <p className="text-sm font-medium text-slate-600">{t("pricing.page.freeTagline")}</p>
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold tracking-tight text-pd-foreground">
                {formatInr(0)}
              </span>
              <span className="text-sm font-medium text-slate-600">{t("pricing.perMonth")}</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-emerald-800">{t("pricing.page.noCardRequired")}</p>

            <div className="my-3 h-px bg-slate-200/80" />

            <PlanFeatureList items={[...FREE_FEATURES]} variant="free" />

            <p className="mt-3 flex w-full items-center gap-2 rounded-lg border border-dashed border-amber-300/90 bg-amber-50 px-3 py-2.5 text-sm font-medium leading-snug text-amber-900">
              <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("pricing.page.freeUpsell")}
            </p>
          </PlanCardShell>

          <PlanCardShell
            variant="pro"
            footer={
              <>
                {!authLoading && isPro ? (
                  <Button disabled className="h-11 w-full rounded-xl text-sm font-bold">
                    {t("pricing.currentPlan")}
                  </Button>
                ) : (
                  <>
                    <p className="mb-2.5 text-center text-xs font-semibold text-pd-brand">
                      {t("pricing.page.proCtaNote")}
                    </p>
                    <Button
                      className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-bold shadow-lg shadow-blue-200/50 transition-all hover:shadow-xl hover:shadow-blue-300/40"
                      loading={checkoutLoading}
                      onClick={() => void handleProUpgrade()}
                    >
                      <Crown className="h-4 w-4" />
                      {user ? t("pricing.upgrade") : t("pricing.signupToUpgrade")}
                    </Button>
                  </>
                )}
                {checkoutError ? (
                  <p className="mt-1 text-center text-xs text-red-600" role="alert">
                    {checkoutError}
                  </p>
                ) : null}
              </>
            }
          >
            <div className="mb-3 flex justify-center">
              <span className="inline-flex whitespace-nowrap rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-1.5 text-xs font-bold uppercase leading-none tracking-wide text-white shadow-md">
                {t("pricing.mostPopular")}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200/40">
                <Crown className="h-5 w-5 text-white" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-pd-foreground">{t("pricing.page.proName")}</h2>
                <p className="text-sm font-medium text-slate-600">{t("pricing.page.proTagline")}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="text-4xl font-extrabold tracking-tight text-pd-foreground">
                {proPriceDisplay}
              </span>
              <span className="text-sm font-medium text-slate-600">{proPeriod}</span>
              {isYearly && monthlyEquivalentInr ? (
                <span className="w-full text-sm font-semibold text-pd-brand">
                  ≈ {formatInr(monthlyEquivalentInr)}
                  {t("pricing.perMonth")} {t("pricing.page.billedYearly")}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm font-medium text-pd-brand">
              {isInr
                ? t("pricing.page.gstNote")
                : t("pricing.displayCurrencyNote", {
                    currency,
                    inrAmount: proPriceInr.toLocaleString("en-IN"),
                  })}
            </p>

            <div className="my-3 h-px bg-blue-200/80" />

            <PlanFeatureList
              items={[
                ...PRO_FEATURES,
                t("pricing.page.proExtra1"),
                t("pricing.page.proExtra2"),
              ]}
              variant="pro"
            />
          </PlanCardShell>

          <PlanCardShell
            variant="business"
            footer={
              <Link href="/contact?subject=business" className="block">
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-xl border-2 border-violet-300 bg-white text-sm font-bold text-violet-800 transition-all hover:border-violet-400 hover:bg-violet-50"
                >
                  {t("pricing.page.businessCta")}
                </Button>
              </Link>
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-slate-700 shadow-md shadow-violet-200/40">
                  <Building2 className="h-5 w-5 text-white" aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-pd-foreground">{t("pricing.page.businessName")}</h2>
                    <Crown className="h-4 w-4 text-amber-500" aria-hidden />
                  </div>
                  <p className="text-sm font-medium text-slate-600">{t("pricing.page.businessTagline")}</p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                <Users className="h-3.5 w-3.5" aria-hidden />
                20+
              </span>
            </div>

            <div className="mt-3">
              <span className="text-4xl font-extrabold tracking-tight text-pd-foreground">
                {t("pricing.page.businessPrice")}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-600">{t("pricing.page.businessPriceDesc")}</p>

            <div className="my-3 h-px bg-slate-200/80" />

            <p className="mb-2 text-sm font-bold text-pd-foreground">{t("pricing.page.businessIncludes")}</p>
            <PlanFeatureList
              items={[
                t("pricing.page.businessFeature1"),
                t("pricing.page.businessFeature2"),
                t("pricing.page.businessFeature3"),
              ]}
              variant="business"
            />

            <div className="mt-3 rounded-xl border border-violet-200/80 bg-violet-50/60 px-3 py-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-violet-700" aria-hidden />
                <span className="rounded-full bg-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {t("pricing.page.businessHighlightBadge")}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium leading-snug text-violet-950">
                {t("pricing.page.businessHighlightDesc")}
              </p>
            </div>
          </PlanCardShell>
        </div>

        {/* Comparison table */}
        <section className="mt-20">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-pd-foreground sm:text-3xl">
              {t("pricing.page.compareTitle")}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-pd-muted">{t("pricing.page.compareDesc")}</p>
          </div>

          <div className="mt-8 overflow-hidden rounded-3xl border border-pd-border/80 bg-white/90 shadow-sm backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-pd-border bg-slate-50/80">
                    <th className="px-5 py-4 text-sm font-bold text-pd-foreground sm:px-6">
                      {t("pricing.features")}
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-bold text-emerald-700">
                      {t("pricing.page.freeName")}
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-bold text-pd-brand">
                      {t("pricing.page.proName")}
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-bold text-violet-700">
                      {t("pricing.page.businessName")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row, i) => (
                    <tr
                      key={row.labelKey}
                      className={cn(
                        "border-b border-pd-border/60 transition hover:bg-pd-brand-muted/30",
                        i === COMPARE_ROWS.length - 1 && "border-b-0"
                      )}
                    >
                      <td className="px-5 py-4 text-sm font-medium text-pd-foreground sm:px-6">
                        {t(`pricing.page.compare.${row.labelKey}`)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <CompareCell
                          value={row.free}
                          text={
                            row.labelKey === "fileSize"
                              ? planFileSizeMarketingLabel(false)
                              : row.freeTextKey
                                ? t(`pricing.page.compare.${row.freeTextKey}`)
                                : undefined
                          }
                        />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <CompareCell
                          value={row.pro}
                          text={
                            row.labelKey === "fileSize"
                              ? planFileSizeMarketingLabel(true)
                              : row.proTextKey
                                ? t(`pricing.page.compare.${row.proTextKey}`)
                                : undefined
                          }
                        />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <CompareCell
                          value={row.business}
                          text={
                            row.businessTextKey
                              ? t(`pricing.page.compare.${row.businessTextKey}`)
                              : undefined
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Why upgrade */}
        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold text-pd-foreground">{t("pricing.page.whyTitle")}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFIT_KEYS.map((key) => (
              <div
                key={key}
                className="rounded-2xl border border-pd-border/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-pd-brand/30 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pd-brand-muted">
                  {key === "benefit1" && <Sparkles className="h-5 w-5 text-pd-brand" aria-hidden />}
                  {key === "benefit2" && <Timer className="h-5 w-5 text-pd-brand" aria-hidden />}
                  {key === "benefit3" && <Headphones className="h-5 w-5 text-pd-brand" aria-hidden />}
                  {key === "benefit4" && <IndianRupee className="h-5 w-5 text-pd-brand" aria-hidden />}
                </div>
                <h3 className="mt-4 font-bold text-pd-foreground">{t(`pricing.page.${key}Title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-pd-muted">{t(`pricing.page.${key}Desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-20">
          <h2 className="text-center text-2xl font-bold text-pd-foreground sm:text-3xl">
            {t("pricing.faq.title")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-pd-muted">{t("pricing.page.faqDesc")}</p>
          <div className="mt-8 space-y-3">
            {FAQ_KEYS.map((key) => (
              <FaqItem
                key={key}
                question={t(`pricing.page.faq.${key}`)}
                answer={
                  key === "q1"
                    ? t("pricing.page.faq.a1", {
                        freeSize: FILE_LIMITS.maxFreeFileSizeMB,
                        proSize: FILE_LIMITS.maxProFileSizeMB,
                      })
                    : t(`pricing.page.faq.a${key.slice(1)}`)
                }
              />
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative mt-16 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 px-6 py-12 text-center text-white shadow-xl shadow-indigo-300/30 sm:px-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
          />
          <h2 className="relative text-2xl font-bold sm:text-3xl">{t("pricing.page.ctaTitle")}</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-white/85">{t("pricing.page.ctaDesc")}</p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/#tools">
              <Button
                size="lg"
                variant="secondary"
                className="rounded-xl bg-white px-8 font-semibold text-indigo-700 hover:bg-white/90"
              >
                {t("pricing.getStarted")}
              </Button>
            </Link>
            {!isPro && (
              <Button
                size="lg"
                variant="outline"
                className="rounded-xl border-white/40 bg-transparent px-8 font-semibold text-white hover:bg-white/10"
                loading={checkoutLoading}
                onClick={() => void handleProUpgrade()}
              >
                {t("pricing.upgrade")}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}
