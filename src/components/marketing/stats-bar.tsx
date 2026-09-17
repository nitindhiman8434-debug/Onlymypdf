"use client";

import { Wrench, Timer, FileUp, CalendarCheck } from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils/cn";

interface StatItem {
  value: string;
  labelKey: string;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  glow: string;
  accent: string;
}

const STATS: StatItem[] = [
  {
    value: "20+",
    labelKey: "landing.statTools",
    icon: Wrench,
    gradient: "from-blue-500 to-indigo-600",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    glow: "bg-blue-400/25",
    accent: "text-blue-600",
  },
  {
    value: "2 hrs",
    labelKey: "landing.statDelete",
    icon: Timer,
    gradient: "from-rose-500 to-pink-600",
    iconBg: "bg-gradient-to-br from-rose-500 to-pink-600",
    glow: "bg-rose-400/25",
    accent: "text-rose-600",
  },
  {
    value: "25 MB",
    labelKey: "landing.statLimit",
    icon: FileUp,
    gradient: "from-amber-500 to-orange-600",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
    glow: "bg-amber-400/25",
    accent: "text-amber-600",
  },
  {
    value: "5/day",
    labelKey: "landing.statBrowser",
    icon: CalendarCheck,
    gradient: "from-emerald-500 to-teal-600",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600",
    glow: "bg-emerald-400/25",
    accent: "text-emerald-600",
  },
];

export function StatsBar() {
  const { t } = useTranslation();

  return (
    <div className="relative overflow-hidden border-y border-pd-border bg-gradient-to-r from-slate-50 via-white to-slate-50 py-10">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "24px 24px" }} />

      <div className="pd-container relative">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.labelKey}
                className={cn(
                  "group relative flex flex-col items-center gap-3 rounded-2xl border border-white/80 bg-white px-4 py-6",
                  "shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)]",
                  "transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.12)]"
                )}
              >
                {/* Glow blob */}
                <div className={cn("absolute -top-4 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-150", stat.glow)} />

                {/* 3D Icon */}
                <div className={cn(
                  "relative flex h-12 w-12 items-center justify-center rounded-xl shadow-lg ring-1 ring-white/30",
                  "transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6",
                  stat.iconBg
                )}>
                  <Icon className="h-6 w-6 text-white" strokeWidth={2.2} />
                </div>

                {/* Value */}
                <p className={cn("text-2xl font-extrabold tracking-tight sm:text-3xl", stat.accent)}>
                  {stat.value}
                </p>

                {/* Label */}
                <p className="text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {t(stat.labelKey)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
