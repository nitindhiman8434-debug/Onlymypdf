"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { FILE_SIZE_MARKETING, FILE_LIMITS, PRO_PRICING } from "@/config/constants";
import {
  ArrowRight,
  Sparkles,
  Timer,
  Shield,
  UserCheck,
  HardDrive,
  FileSearch,
  ListChecks,
  Zap,
  CalendarCheck,
  Check,
  Upload,
  Search,
  HelpCircle,
  Crown,
  Star,
  Users,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/marketing/section-heading";
import {
  CATEGORY_FALLBACK_LABELS,
  FAQ_KEYS,
  FREE_FEATURES,
  ICON_MAP,
  PRO_FEATURES,
  TOOL_CATEGORIES,
  TOOL_KEYS,
} from "@/components/marketing/home/home-shared";
import { ToolIconTile } from "@/components/tools/tool-icon-tile";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { CurrencyToggle } from "@/components/pricing/currency-toggle";

const WorkflowVisual = dynamic(
  () =>
    import("@/components/marketing/workflow-visual").then((m) => ({
      default: m.WorkflowVisual,
    })),
  { loading: () => <div className="h-48 animate-pulse rounded-2xl bg-pd-border/40" /> }
);

const AiSummaryVisual = dynamic(
  () =>
    import("@/components/marketing/ai-summary-visual").then((m) => ({
      default: m.AiSummaryVisual,
    })),
  { loading: () => <div className="mx-auto h-96 max-w-md animate-pulse rounded-2xl bg-pd-brand-muted" /> }
);

export function ToolsGrid({
  columns = "default",
  compact = false,
}: {
  columns?: "default" | "dense" | "list";
  compact?: boolean;
}) {
  const { t } = useTranslation();

  if (columns === "list") {
    return (
      <div className="space-y-2">
        {TOOL_KEYS.map((tool) => {
          const Icon = ICON_MAP[tool.icon];
          return (
            <Link
              key={tool.slug}
              href={`/${tool.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-pd-border bg-pd-surface px-4 py-3 transition hover:border-pd-brand/30 hover:shadow-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pd-brand-muted text-pd-brand">
                {Icon && <Icon className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-pd-foreground">{t(tool.nameKey)}</p>
                {!compact && (
                  <p className="truncate text-sm text-pd-muted">{t(tool.descKey)}</p>
                )}
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-pd-brand opacity-0 transition group-hover:opacity-100" />
            </Link>
          );
        })}
      </div>
    );
  }

  const gridClass =
    columns === "dense"
      ? "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      : "grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4";

  return (
    <div className={gridClass}>
      {TOOL_KEYS.map((tool) => {
        const Icon = ICON_MAP[tool.icon];
        return (
          <Link
            key={tool.slug}
            href={`/${tool.slug}`}
            className="tool-card-glow group relative rounded-2xl border border-pd-border bg-pd-surface p-4 shadow-sm sm:p-5"
          >
            {"isPro" in tool && tool.isPro && (
              <span className="absolute right-3 top-3 rounded-full bg-pd-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Pro
              </span>
            )}
            {Icon && <ToolIconTile slug={tool.slug} icon={Icon} size="lg" />}
            <h3 className="mt-3 font-semibold text-pd-foreground">{t(tool.nameKey)}</h3>
            {!compact && (
              <p className="mt-1 text-sm leading-relaxed text-pd-muted">{t(tool.descKey)}</p>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function ToolsByCategory() {
  const { t } = useTranslation();

  return (
    <div className="space-y-10">
      {TOOL_CATEGORIES.map((cat) => {
        const tools = TOOL_KEYS.filter((tool) => tool.category === cat.id);
        if (tools.length === 0) return null;
        return (
          <div key={cat.id}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-pd-muted">
              {CATEGORY_FALLBACK_LABELS[cat.id]}
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => {
                const Icon = ICON_MAP[tool.icon];
                return (
                  <Link
                    key={tool.slug}
                    href={`/${tool.slug}`}
                    className="group flex items-center gap-3 rounded-xl border border-pd-border bg-pd-surface p-4 transition hover:border-pd-brand/40"
                  >
                    {Icon && <ToolIconTile slug={tool.slug} icon={Icon} size="sm" />}
                    <div>
                      <p className="font-semibold text-pd-foreground">{t(tool.nameKey)}</p>
                      <p className="text-xs text-pd-muted">{t(tool.descKey)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PopularToolChips() {
  const { t } = useTranslation();
  const popular = ["merge-pdf", "compress-pdf", "pdf-to-word", "sign-pdf", "ai-pdf-summarizer"];

  return (
    <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
      {popular.map((slug) => {
        const tool = TOOL_KEYS.find((t) => t.slug === slug);
        if (!tool) return null;
        const Icon = ICON_MAP[tool.icon];
        return (
          <Link
            key={slug}
            href={`/${slug}`}
            className="inline-flex items-center gap-2 rounded-full border border-pd-border bg-pd-surface px-4 py-2 text-sm font-medium text-pd-foreground transition hover:border-pd-brand hover:text-pd-brand"
          >
            {Icon && <ToolIconTile slug={slug} icon={Icon} size="sm" className="!h-8 !w-8 !rounded-lg" />}
            {t(tool.nameKey)}
          </Link>
        );
      })}
    </div>
  );
}

export function WorkflowSection() {
  const { t } = useTranslation();
  return (
    <section className="mesh-section pd-section sm:py-28">
      <div className="pd-container">
        <SectionHeading
          eyebrow={t("landing.workflowEyebrow")}
          title={t("landing.workflowTitle")}
          description={t("landing.workflowDesc")}
        />
        <div className="mt-16">
          <WorkflowVisual />
        </div>
      </div>
    </section>
  );
}

export function AISection({ split = false }: { split?: boolean }) {
  const { t } = useTranslation();

  const content = (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-pd-border bg-pd-surface px-3 py-1 text-xs font-semibold text-pd-brand">
        <Sparkles className="h-3.5 w-3.5" /> {t("landing.aiBadge")}
      </span>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-pd-foreground sm:text-4xl">
        {t("landing.aiTitle")}
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-pd-muted">{t("landing.aiDesc")}</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {[
          { icon: FileSearch, title: t("landing.aiFeature1Title"), desc: t("landing.aiFeature1Desc") },
          { icon: ListChecks, title: t("landing.aiFeature2Title"), desc: t("landing.aiFeature2Desc") },
          { icon: Zap, title: t("landing.aiFeature3Title"), desc: t("landing.aiFeature3Desc") },
          { icon: CalendarCheck, title: t("landing.aiFeature4Title"), desc: t("landing.aiFeature4Desc") },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-pd-border bg-pd-surface p-4">
            <f.icon className="h-5 w-5 text-pd-brand" />
            <h3 className="mt-2 text-sm font-semibold text-pd-foreground">{f.title}</h3>
            <p className="mt-0.5 text-xs text-pd-muted">{f.desc}</p>
          </div>
        ))}
      </div>
      <Link href="/ai-pdf-summarizer" className="mt-8 inline-block">
        <Button size="lg">
          {t("landing.aiCta")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </>
  );

  if (split) {
    return (
      <section className="bg-pd-brand-muted pd-section sm:py-28">
        <div className="pd-container">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="order-2 overflow-visible lg:order-1">
              <AiSummaryVisual />
            </div>
            <div className="order-1 lg:order-2">{content}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-pd-brand-muted pd-section sm:py-28">
      <div className="pd-container max-w-3xl">{content}</div>
    </section>
  );
}

export function SecuritySection({ variant = "dark" }: { variant?: "dark" | "cards" }) {
  const { t } = useTranslation();
  const items = [
    { icon: Timer, title: t("landing.security1Title"), desc: t("landing.security1Desc") },
    { icon: Shield, title: t("landing.security2Title"), desc: t("landing.security2Desc") },
    { icon: UserCheck, title: t("landing.security3Title"), desc: t("landing.security3Desc") },
    { icon: HardDrive, title: t("landing.security4Title"), desc: t("landing.security4Desc") },
  ];

  if (variant === "cards") {
    return (
      <section className="pd-section sm:py-28">
        <div className="pd-container">
          <SectionHeading
            eyebrow={t("landing.securityEyebrow")}
            title={t("landing.securityTitle")}
            description={t("landing.securityDesc")}
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {items.map((f) => (
              <div key={f.title} className="flex gap-4 rounded-2xl border border-pd-border bg-pd-surface p-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pd-brand-muted text-pd-brand">
                  <f.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-pd-foreground">{f.title}</h3>
                  <p className="mt-1 text-sm text-pd-muted">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section-dark pd-section sm:py-28">
      <div className="pd-container">
        <SectionHeading
          eyebrow={t("landing.securityEyebrow")}
          title={t("landing.securityTitle")}
          description={t("landing.securityDesc")}
          className="[&_h2]:text-white [&_p]:text-white/75 [&_span]:border-white/20 [&_span]:bg-white/10 [&_span]:text-white"
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                <f.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PRICING_LEFT_BENEFITS = [
  {
    icon: Upload,
    title: "Start free in seconds",
    desc: "No signup · Works in your browser",
    accent: "text-pd-brand",
    bg: "bg-pd-brand-muted",
  },
  {
    icon: HardDrive,
    title: "Clear file size limits",
    desc: `${FILE_SIZE_MARKETING.freeLabel} free · ${FILE_SIZE_MARKETING.proLabel} on Pro`,
    accent: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    icon: Shield,
    title: "Secure by default",
    desc: "HTTPS transfer · 2h Free retention setting",
    accent: "text-pd-success",
    bg: "bg-emerald-50",
  },
  {
    icon: Star,
    title: "Published plan limits",
    desc: "5 Free uses/day · 100 Pro uses/day",
    accent: "text-amber-800",
    bg: "bg-amber-50",
  },
] as const;

const PRICING_RIGHT_BENEFITS = [
  {
    icon: Sparkles,
    title: "AI PDF Summarizer",
    desc: "Read less, understand faster",
    accent: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    icon: Zap,
    title: "100 uses per day",
    desc: "20× more than the free plan",
    accent: "text-pd-brand",
    bg: "bg-pd-brand-muted",
  },
  {
    icon: Users,
    title: "Built for power users",
    desc: "Batch jobs · Priority speed",
    accent: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  {
    icon: Crown,
    title: "Most popular upgrade",
    desc: "Unlock every PDF tool",
    accent: "text-pd-brand",
    bg: "bg-pd-brand-muted",
  },
] as const;

function PricingAsideBenefit({
  icon: Icon,
  title,
  desc,
  accent,
  bg,
  align = "left",
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  accent: string;
  bg: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex w-full gap-3 rounded-xl border border-pd-border/80 bg-white/90 p-3.5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-pd-brand/25 hover:shadow-md lg:max-w-[220px]",
        align === "right" && "lg:flex-row-reverse lg:text-right"
      )}
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", bg)}>
        <Icon className={cn("h-4 w-4", accent)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-pd-foreground">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-pd-muted">{desc}</p>
      </div>
    </div>
  );
}

function PricingAsideColumn({
  benefits,
  align,
}: {
  benefits: typeof PRICING_LEFT_BENEFITS | typeof PRICING_RIGHT_BENEFITS;
  align: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "hidden flex-col gap-3 lg:flex",
        align === "left" ? "items-end" : "items-start"
      )}
    >
      {benefits.map((item) => (
        <PricingAsideBenefit key={item.title} {...item} align={align} />
      ))}
    </div>
  );
}

export function PricingSection({ centered = true }: { centered?: boolean }) {
  const { t } = useTranslation();
  const { currency, setCurrency, formatInr, isInr } = useDisplayCurrency();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-pd-background via-slate-50/50 to-pd-background py-14 sm:py-18">
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "28px 28px" }} />
      <div className={cn("pd-container relative", centered && "max-w-6xl")}>
        <SectionHeading
          eyebrow={t("landing.pricingEyebrow")}
          title={t("landing.pricingTitle")}
          description={t("landing.pricingDesc")}
        />

        <div className="mt-6 flex justify-center">
          <CurrencyToggle
            value={currency}
            onChange={setCurrency}
            label={t("pricing.currencyLabel")}
          />
        </div>

        <div className="mt-10 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-8 xl:gap-10">
          <PricingAsideColumn benefits={PRICING_LEFT_BENEFITS} align="left" />

          <div className="mx-auto grid w-full max-w-sm items-stretch gap-4 sm:max-w-2xl sm:grid-cols-2 sm:gap-5">
          {/* Free Plan */}
          <div className={cn(
            "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/70 bg-white",
            "shadow-[0_2px_20px_-6px_rgba(0,0,0,0.07)]",
            "transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.12)]"
          )}>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/60 via-white to-white opacity-80" />
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-400/10 blur-2xl" />

            <div className="relative z-10 flex flex-1 flex-col p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md ring-1 ring-white/20">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">{t("landing.pricingFree")}</h3>
                  <p className="text-[11px] font-medium text-gray-400">Perfect to get started</p>
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight text-gray-900">
                  {formatInr(0)}
                </span>
                <span className="text-sm text-gray-400">{t("landing.pricingPerMonth")}</span>
              </div>

              <div className="my-4 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

              <ul className="space-y-2.5">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-gray-600">
                    <div className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <Check className="h-3 w-3 text-emerald-600" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex justify-center pt-5">
                <Link href="#tools">
                  <Button
                    variant="outline"
                    className="rounded-xl border-gray-200 px-6 py-2.5 text-sm font-semibold transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    {t("landing.pricingFreeCta")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Pro Plan */}
          <div className={cn(
            "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border-2 border-pd-brand/30 bg-white",
            "shadow-[0_4px_24px_-6px_rgba(37,99,235,0.15)]",
            "transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_-8px_rgba(37,99,235,0.2)]"
          )}>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-indigo-50/30 to-white" />
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-400/15 blur-2xl" />
            <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-indigo-400/10 blur-2xl" />

            <div className="relative z-10 flex flex-1 flex-col p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md ring-1 ring-white/20">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{t("landing.pricingPro")}</h3>
                    <p className="text-[11px] font-medium text-gray-400">For power users & teams</p>
                  </div>
                </div>
                <span className="rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-1 text-[10px] font-bold tracking-wide text-white shadow-md">
                  {t("landing.pricingPopular")}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                <span className="text-4xl font-extrabold tracking-tight text-gray-900">
                  {formatInr(PRO_PRICING.monthlyInr)}
                </span>
                <span className="text-sm text-gray-400">{t("landing.pricingPerMonth")}</span>
              </div>
              {!isInr ? (
                <p className="mt-1 text-[11px] font-medium text-pd-brand">
                  {t("pricing.displayCurrencyNote", {
                    currency,
                    inrAmount: PRO_PRICING.monthlyInr.toLocaleString("en-IN"),
                  })}
                </p>
              ) : null}

              <div className="my-4 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />

              <ul className="space-y-2.5">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-gray-600">
                    <div className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-blue-100">
                      <Check className="h-3 w-3 text-blue-600" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex justify-center pt-5">
                <Link href="/pricing">
                  <Button className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200 transition-all hover:shadow-lg hover:shadow-blue-300">
                    {t("landing.pricingProCta")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          </div>

          <PricingAsideColumn benefits={PRICING_RIGHT_BENEFITS} align="right" />
        </div>

        {/* Mobile / tablet — key benefits below cards */}
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-3 lg:hidden">
          {[...PRICING_LEFT_BENEFITS.slice(0, 2), ...PRICING_RIGHT_BENEFITS.slice(0, 2)].map(
            (item) => (
              <PricingAsideBenefit key={item.title} {...item} align="left" />
            )
          )}
        </div>
      </div>
    </section>
  );
}

const FAQ_COLORS = [
  {
    num: "bg-gradient-to-br from-blue-500 to-indigo-600",
    glow: "bg-blue-400/25",
    ring: "ring-blue-200/80",
    panel: "from-blue-50/90 to-indigo-50/50",
  },
  {
    num: "bg-gradient-to-br from-emerald-500 to-teal-600",
    glow: "bg-emerald-400/25",
    ring: "ring-emerald-200/80",
    panel: "from-emerald-50/90 to-teal-50/50",
  },
  {
    num: "bg-gradient-to-br from-amber-500 to-orange-600",
    glow: "bg-amber-400/25",
    ring: "ring-amber-200/80",
    panel: "from-amber-50/90 to-orange-50/50",
  },
  {
    num: "bg-gradient-to-br from-rose-500 to-pink-600",
    glow: "bg-rose-400/25",
    ring: "ring-rose-200/80",
    panel: "from-rose-50/90 to-pink-50/50",
  },
  {
    num: "bg-gradient-to-br from-violet-500 to-purple-600",
    glow: "bg-violet-400/25",
    ring: "ring-violet-200/80",
    panel: "from-violet-50/90 to-purple-50/50",
  },
  {
    num: "bg-gradient-to-br from-cyan-500 to-sky-600",
    glow: "bg-cyan-400/25",
    ring: "ring-cyan-200/80",
    panel: "from-cyan-50/90 to-sky-50/50",
  },
  {
    num: "bg-gradient-to-br from-fuchsia-500 to-pink-600",
    glow: "bg-fuchsia-400/25",
    ring: "ring-fuchsia-200/80",
    panel: "from-fuchsia-50/90 to-pink-50/50",
  },
] as const;

export function FAQSection() {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const hasOpen = openIndex !== null;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-pd-surface via-pd-background to-pd-surface pd-section sm:py-28">
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/4 top-20 h-56 w-56 rounded-full bg-pd-brand/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-16 right-1/4 h-48 w-48 rounded-full bg-indigo-400/10 blur-3xl"
      />

      <div className="pd-container relative max-w-3xl">
        <div className="mb-3 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-pd-brand-muted px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-pd-brand-hover">
            <HelpCircle className="h-3.5 w-3.5" />
            FAQ
          </span>
        </div>
        <SectionHeading title={t("landing.faqTitle")} />

        <div className="mt-12">
          <div className="space-y-4">
            {FAQ_KEYS.map((key, i) => {
              const color = FAQ_COLORS[i % FAQ_COLORS.length];
              const isOpen = openIndex === i;
              const isBehind = hasOpen && !isOpen;

              return (
                <div
                  key={key}
                  className={cn(
                    "relative isolate rounded-2xl border bg-white/95 backdrop-blur-sm transition-all duration-500 ease-out",
                    isOpen
                      ? cn(
                          "z-10 -translate-y-1 scale-[1.01] border-pd-brand/25 shadow-[0_30px_60px_-28px_rgba(37,99,235,0.45)] ring-2",
                          color.ring
                        )
                      : isBehind
                        ? "z-[1] scale-[0.99] border-pd-border/50 opacity-85 shadow-sm"
                        : "z-[1] border-white/90 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] hover:-translate-y-0.5 hover:border-pd-brand/15 hover:shadow-[0_16px_32px_-16px_rgba(37,99,235,0.2)]"
                  )}
                >
                  {isOpen && (
                    <div
                      className={cn(
                        "pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br opacity-60",
                        color.panel
                      )}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="relative z-10 flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left"
                    aria-expanded={isOpen}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-lg transition-all duration-500",
                        color.num,
                        isOpen ? "scale-110 shadow-xl" : "shadow-md"
                      )}
                    >
                      {i + 1}
                    </div>
                    <span
                      className={cn(
                        "flex-1 text-[15px] font-semibold transition-colors duration-300",
                        isOpen ? "text-pd-foreground" : "text-gray-700"
                      )}
                    >
                      {t(`landing.${key}q`)}
                    </span>
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-light transition-all duration-500",
                        isOpen
                          ? "rotate-45 bg-pd-brand text-white shadow-md shadow-pd-brand/30"
                          : "bg-gray-100 text-gray-400"
                      )}
                    >
                      +
                    </span>
                  </button>

                  <div
                    className={cn(
                      "relative grid transition-all duration-500 ease-out",
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div
                        className={cn(
                          "relative px-5 pb-5 transition-all duration-500",
                          isOpen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
                        )}
                      >
                        <div
                          className={cn(
                            "absolute -left-2 top-0 h-full w-24 rounded-full blur-3xl",
                            color.glow
                          )}
                        />
                        <div
                          className={cn(
                            "relative ml-[52px] rounded-xl border border-white/70 bg-gradient-to-br px-4 py-3.5 shadow-inner",
                            color.panel
                          )}
                        >
                          <p className="text-sm leading-relaxed text-gray-600">
                            {key === "faq2"
                              ? t("landing.faq2a", {
                                  freeSize: FILE_LIMITS.maxFreeFileSizeMB,
                                  proSize: FILE_LIMITS.maxProFileSizeMB,
                                })
                              : key === "faq4"
                                ? t("landing.faq4a", {
                                    freeSize: FILE_LIMITS.maxFreeFileSizeMB,
                                    proSize: FILE_LIMITS.maxProFileSizeMB,
                                  })
                                : t(`landing.${key}a`)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CTASection() {
  const { t } = useTranslation();
  return (
    <section className="bg-pd-brand py-16 sm:py-20">
      <div className="pd-container max-w-4xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {t("landing.ctaTitle")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-white">{t("landing.ctaDesc")}</p>
        <Link href="#tools" className="mt-8 inline-block">
          <Button size="lg" variant="secondary" className="bg-white text-pd-brand hover:bg-white/90">
            {t("landing.ctaButton")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

export function HeroCopy({ align = "center" }: { align?: "center" | "left" }) {
  const { t } = useTranslation();
  const isLeft = align === "left";

  return (
    <div
      className={
        isLeft
          ? "pd-hero-copy mx-auto w-full max-w-xl text-center lg:mx-0 lg:max-w-[34rem] lg:text-left"
          : "text-center"
      }
    >
      <span
        className={
          isLeft
            ? "pd-hero-badge inline-flex h-8 w-fit max-w-full items-center gap-1.5 self-center rounded-full border border-pd-border bg-pd-surface px-3.5 text-[11px] font-semibold leading-none text-pd-brand shadow-sm lg:self-start"
            : "inline-flex h-8 items-center gap-1.5 rounded-full border border-pd-border bg-pd-surface px-3.5 text-[11px] font-semibold leading-none text-pd-brand shadow-sm"
        }
      >
        <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
        <span className="whitespace-nowrap">{t("landing.heroBadge")}</span>
      </span>
      {isLeft ? (
        <h1 className="pd-hero-headline pd-display mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:mt-6 lg:text-[2.875rem] lg:leading-[1.2] xl:text-[3.125rem]">
          <span className="pd-hero-line block text-pd-foreground lg:whitespace-nowrap">
            {t("landing.heroTitle")}
          </span>
          <span className="pd-hero-line mt-1 block bg-gradient-to-r from-blue-600 via-violet-500 to-rose-500 bg-clip-text text-transparent lg:mt-1.5 lg:whitespace-nowrap">
            {t("landing.heroTitleHighlight")}
          </span>
        </h1>
      ) : (
        <h1 className="pd-display mt-6 text-4xl font-extrabold tracking-tight text-pd-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
          {t("landing.heroTitle")}{" "}
          <span className="bg-gradient-to-r from-blue-600 via-violet-500 to-rose-500 bg-clip-text text-transparent">{t("landing.heroTitleHighlight")}</span>
        </h1>
      )}
      <p
        className={`pd-prose mt-6 w-full text-lg leading-relaxed text-pd-muted ${
          isLeft ? "lg:mx-0" : "mx-auto max-w-xl"
        }`}
      >
        {t("landing.heroSubtitle")}
      </p>
      <div
        className={`pd-hero-actions mt-10 flex flex-col items-center gap-4 sm:flex-row ${
          isLeft ? "lg:justify-start" : "justify-center"
        }`}
      >
        <Link href="#tools">
          <Button size="lg">
            {t("landing.heroCtaPrimary")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/pricing">
          <Button variant="outline" size="lg">
            <Crown className="h-4 w-4" />
            {t("landing.heroCtaSecondary")}
          </Button>
        </Link>
      </div>
      <p className="mt-6 text-sm text-pd-muted">{t("landing.heroTrust")}</p>
    </div>
  );
}

export function UploadFirstHero() {
  const { t } = useTranslation();
  return (
    <section className="border-b border-pd-border bg-pd-surface pd-section">
      <div className="pd-container">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="pd-display text-3xl font-extrabold tracking-tight text-pd-foreground sm:text-4xl">
            {t("landing.heroTitle")}{" "}
            <span className="bg-gradient-to-r from-blue-600 via-violet-500 to-rose-500 bg-clip-text text-transparent">{t("landing.heroTitleHighlight")}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pd-muted">{t("landing.heroSubtitle")}</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <div className="relative w-full max-w-lg">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-pd-muted" />
              <input
                type="search"
                readOnly
                placeholder="Search tools: merge, compress, convert..."
                className="h-12 w-full rounded-xl border border-pd-border bg-pd-background pl-11 pr-4 text-sm text-pd-foreground"
                aria-label="Search PDF tools"
              />
            </div>
            <Link href="/merge-pdf">
              <Button size="lg">
                <Upload className="h-4 w-4" />
                {t("landing.heroCtaPrimary")}
              </Button>
            </Link>
          </div>
          <div className="mt-6">
            <PopularToolChips />
          </div>
        </div>
      </div>
    </section>
  );
}

export function WizardSteps() {
  const { t } = useTranslation();
  const steps = [
    { n: 1, title: t("landing.workflowUpload"), desc: t("landing.workflowUploadDesc") },
    { n: 2, title: t("landing.workflowProcess"), desc: t("landing.workflowProcessDesc") },
    { n: 3, title: t("landing.workflowDownload"), desc: t("landing.workflowDownloadDesc") },
  ];

  return (
    <div className="pd-step-bar">
      {steps.map((step, i) => (
        <div key={step.n} className="flex flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pd-brand text-sm font-bold text-white">
            {step.n}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-pd-foreground">{step.title}</p>
            <p className="text-xs text-pd-muted">{step.desc}</p>
          </div>
          {i < steps.length - 1 && (
            <div className="hidden h-px flex-1 bg-pd-border lg:block" aria-hidden />
          )}
        </div>
      ))}
    </div>
  );
}
