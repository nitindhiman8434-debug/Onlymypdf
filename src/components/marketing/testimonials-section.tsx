"use client";

import { Clock3, FileCheck2, Gauge, ShieldCheck } from "lucide-react";
import { FILE_LIMITS } from "@/config/constants";
import { SectionHeading } from "@/components/marketing/section-heading";
import { useTranslation } from "@/i18n";

const CARDS = [
  {
    id: "tools",
    icon: FileCheck2,
    value: "20+",
    className: "bg-blue-50 text-blue-800",
  },
  {
    id: "free",
    icon: Gauge,
    value: `${FILE_LIMITS.maxFreeUsesPerDay}/day`,
    className: "bg-emerald-50 text-emerald-800",
  },
  {
    id: "limits",
    icon: ShieldCheck,
    value: `${FILE_LIMITS.maxFreeFileSizeMB}/${FILE_LIMITS.maxProFileSizeMB} MB`,
    className: "bg-violet-50 text-violet-800",
  },
  {
    id: "retention",
    icon: Clock3,
    value: "2h/24h",
    className: "bg-amber-50 text-amber-900",
  },
] as const;

/**
 * Kept under the historical export name so home-layout variants stay stable.
 * This section intentionally contains product facts instead of invented reviews.
 */
export function TestimonialsSection() {
  const { t } = useTranslation();

  return (
    <section className="border-y border-pd-border bg-pd-background pd-section sm:py-20">
      <div className="pd-container">
        <SectionHeading
          eyebrow={t("landing.evidenceEyebrow")}
          title={t("landing.evidenceTitle")}
          description={t("landing.evidenceDesc")}
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.id}
                className="rounded-2xl border border-pd-border bg-pd-surface p-5 shadow-sm"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.className}`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <p className="mt-4 text-2xl font-extrabold text-pd-foreground">
                  {card.value}
                </p>
                <h3 className="mt-1 text-sm font-bold text-pd-foreground">
                  {t(`landing.evidence_${card.id}_title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-pd-muted">
                  {t(`landing.evidence_${card.id}_desc`)}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
