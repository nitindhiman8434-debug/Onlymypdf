"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { FileText, Lock, Sparkles, Combine, FileDown, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SmartSearch } from "@/components/home/SmartSearch";
import { localeHref, t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Mode = "3d" | "demo";

export function Hero({ locale }: { locale: Locale }) {
  const [mode, setMode] = useState<Mode>("3d");
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-soft bg-hero-glow">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
        {/* ---- Left: copy ---- */}
        <div>
          <div className="mb-5 flex flex-wrap gap-2">
            <Badge kind="privacy">{t(locale, "hero.badges.noSignup")}</Badge>
            <Badge kind="privacy">{t(locale, "hero.badges.autoDelete")}</Badge>
            <Badge kind="accuracy">{t(locale, "hero.badges.highAccuracy")}</Badge>
            <Badge kind="neutral">{t(locale, "hero.badges.bilingual")}</Badge>
          </div>

          <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight text-navy sm:text-5xl">
            {t(locale, "hero.headline")}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-navy/70">
            {t(locale, "hero.subheading")}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={localeHref(locale, "/tools")}>
              <Button size="lg" variant="gradient">{t(locale, "hero.ctaPrimary")}</Button>
            </Link>
            <Link href={localeHref(locale, "/tools")}>
              <Button size="lg" variant="secondary">{t(locale, "hero.ctaSecondary")}</Button>
            </Link>
          </div>

          <div className="mt-8 max-w-xl">
            <SmartSearch locale={locale} />
          </div>
        </div>

        {/* ---- Right: animation with live toggle ---- */}
        <div>
          <div className="mb-3 flex justify-center">
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm shadow-card">
              {(["3d", "demo"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={cn(
                    "rounded-full px-4 py-1.5 font-medium transition-colors",
                    mode === m ? "bg-navy text-white" : "text-navy/60 hover:text-navy"
                  )}
                >
                  {m === "3d" ? t(locale, "hero.toggle3d") : t(locale, "hero.toggleDemo")}
                </button>
              ))}
            </div>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-md rounded-2xl">
            {mode === "3d" ? (
              <ThreeDObjects reduce={!!reduce} />
            ) : (
              <ProductDemo reduce={!!reduce} locale={locale} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Mode 1: floating 3D PDF objects ---------------- */
function ThreeDObjects({ reduce }: { reduce: boolean }) {
  const float = (delay: number) =>
    reduce ? {} : { animate: { y: [0, -12, 0] }, transition: { duration: 6, repeat: Infinity, delay } };

  return (
    <div className="relative h-full w-full">
      <motion.div {...float(0)} className="absolute left-6 top-8 flex h-40 w-32 flex-col gap-2 rounded-2xl bg-white p-4 shadow-glow">
        <FileText className="h-7 w-7 text-brand" />
        <div className="h-2 w-3/4 rounded bg-slate-100" />
        <div className="h-2 w-full rounded bg-slate-100" />
        <div className="h-2 w-2/3 rounded bg-slate-100" />
      </motion.div>

      <motion.div {...float(1.2)} className="absolute right-4 top-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
        <Combine className="h-7 w-7" />
      </motion.div>

      <motion.div {...float(0.6)} className="absolute right-10 bottom-16 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet to-coral text-white shadow-glow">
        <Sparkles className="h-7 w-7" />
      </motion.div>

      <motion.div {...float(1.8)} className="absolute left-2 bottom-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-healing to-teal text-white shadow-glow">
        <Lock className="h-7 w-7" />
      </motion.div>

      <motion.div {...float(0.9)} className="absolute right-24 bottom-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-coral shadow-glow">
        <FileDown className="h-6 w-6" />
      </motion.div>
    </div>
  );
}

/* ---------------- Mode 2: product demo mockup ---------------- */
function ProductDemo({ reduce, locale }: { reduce: boolean; locale: Locale }) {
  const steps = ["Upload", "Processing", "Quality check", "Download"];
  return (
    <div className="flex h-full w-full flex-col gap-4 rounded-2xl bg-white p-6 shadow-glow">
      <div className="flex items-center justify-between">
        <Badge kind="accuracy">{t(locale, "hero.badges.highAccuracy")}</Badge>
        <Badge kind="privacy">{t(locale, "hero.badges.autoDelete")}</Badge>
      </div>

      <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-navy/60">
        report-2026.pdf
      </div>

      {/* animated progress meter */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-navy/60">
          <span>{t(locale, "processing.title")}</span>
          <span>86%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-brand-gradient shimmer"
            initial={{ width: reduce ? "86%" : "10%" }}
            animate={{ width: "86%" }}
            transition={reduce ? { duration: 0 } : { duration: 2.4, repeat: Infinity, repeatType: "reverse" }}
          />
        </div>
      </div>

      <ul className="mt-1 space-y-2 text-sm">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2 text-navy/70">
            <CheckCircle2 className={cn("h-4 w-4", i < 3 ? "text-healing" : "text-slate-300")} />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
