"use client";

import {
  Users,
  Star,
  Globe,
  MessageCircle,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { SectionHeading } from "@/components/marketing/section-heading";
import { cn } from "@/lib/utils/cn";

const CARDS: {
  id: string;
  icon: React.ElementType;
  iconBg: string;
  badge?: string;
  badgeBg?: string;
  accent: string;
}[] = [
  { id: "users", icon: Users, iconBg: "bg-gradient-to-br from-blue-600 to-blue-700", badge: "20+ tools", badgeBg: "bg-blue-800", accent: "from-blue-50 to-white" },
  { id: "business", icon: Star, iconBg: "bg-gradient-to-br from-amber-600 to-orange-700", badge: "Clear limits", badgeBg: "bg-amber-800", accent: "from-amber-50 to-white" },
  { id: "everywhere", icon: Globe, iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600", accent: "from-emerald-50 to-white" },
  { id: "support", icon: MessageCircle, iconBg: "bg-gradient-to-br from-violet-600 to-purple-700", badge: "Contact", badgeBg: "bg-violet-800", accent: "from-violet-50 to-white" },
  { id: "encryption", icon: Lock, iconBg: "bg-gradient-to-br from-rose-600 to-pink-700", badge: "HTTPS", badgeBg: "bg-rose-800", accent: "from-rose-50 to-white" },
  { id: "standards", icon: ShieldCheck, iconBg: "bg-gradient-to-br from-cyan-700 to-sky-800", badge: "Privacy", badgeBg: "bg-cyan-900", accent: "from-cyan-50 to-white" },
];

export function WhyChooseSection() {
  const { t } = useTranslation();

  return (
    <section className="border-y border-pd-border bg-pd-surface py-12 sm:py-14">
      <div className="pd-container">
        <SectionHeading
          title={t("landing.whyChooseTitle")}
          description={t("landing.whyChooseDesc")}
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.id}
                className={cn(
                  "group relative overflow-hidden rounded-xl border border-white/70 bg-white",
                  "shadow-[0_1px_12px_-4px_rgba(0,0,0,0.07)]",
                  "transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12)]"
                )}
              >
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50 group-hover:opacity-80 transition-opacity duration-300", card.accent)} />

                <div className="relative z-10 flex items-start gap-4 p-5">
                  <div className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-md ring-1 ring-white/20",
                    "transition-transform duration-300 group-hover:scale-110",
                    card.iconBg
                  )}>
                    <Icon className="h-5.5 w-5.5 text-white" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-bold text-gray-900">
                        {t(`landing.whyChoose_${card.id}_title`)}
                      </h3>
                      {card.badge && (
                        <span className={cn(
                          "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white",
                          card.badgeBg
                        )}>
                          {card.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
                      {t(`landing.whyChoose_${card.id}_desc`)}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
