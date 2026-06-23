"use client";

import { motion } from "framer-motion";
import { Loader2, CheckCircle2 } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const PROCESSING_STEPS = [
  "uploading",
  "checking",
  "reading",
  "optimizing",
  "processing",
  "quality",
  "preparing",
] as const;
export type ProcessingStep = (typeof PROCESSING_STEPS)[number];

/**
 * Colorful, premium (not childish) processing view with the 7 states,
 * a live "Quality estimate" meter (never a guaranteed-accuracy claim),
 * and contextual messages from smart detection.
 */
export function ProcessingView({
  locale,
  stepIndex,
  qualityEstimate,
  messages = [],
}: {
  locale: Locale;
  stepIndex: number;
  qualityEstimate: number;
  messages?: string[];
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
      <h2 className="text-lg font-semibold text-navy">{t(locale, "processing.title")}</h2>

      {/* Quality estimate meter */}
      <div className="mt-5">
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-navy/70">{t(locale, "processing.qualityEstimate")}</span>
          <span className="font-semibold text-brand">{qualityEstimate}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-brand-gradient shimmer"
            initial={{ width: 0 }}
            animate={{ width: `${qualityEstimate}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      </div>

      {/* Steps */}
      <ol className="mt-6 space-y-2.5">
        {PROCESSING_STEPS.map((step, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <li key={step} className="flex items-center gap-3 text-sm">
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-healing" />
              ) : active ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
              ) : (
                <span className="h-5 w-5 rounded-full border-2 border-slate-200" />
              )}
              <span className={cn(active ? "font-medium text-navy" : "text-navy/50")}>
                {t(locale, `processing.steps.${step}`)}
              </span>
            </li>
          );
        })}
      </ol>

      {messages.length > 0 && (
        <ul className="mt-5 space-y-1 rounded-xl bg-soft p-3 text-sm text-navy/70">
          {messages.map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-navy/50">{t(locale, "processing.autoDeleteNote")}</p>
    </div>
  );
}
