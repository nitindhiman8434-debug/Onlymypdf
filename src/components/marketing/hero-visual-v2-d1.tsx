"use client";

/**
 * V2 · D1 — Frozen animation baseline (saved user-approved view).
 * Do not edit unless intentionally updating the D1 archive.
 */

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  FileStack,
  FileText,
  Layers,
  Minimize2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { FILE_SIZE_MARKETING } from "@/config/constants";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils/cn";

const SCENE_MS = 1250;
const SCENE_COUNT = 4;

function Scene({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center px-6 transition-all duration-500",
        active ? "z-10 scale-100 opacity-100" : "z-0 scale-[0.98] opacity-0"
      )}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}

export function HeroVisualV2D1() {
  const { t } = useTranslation();
  const [scene, setScene] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const sceneTimer = window.setInterval(() => {
      setScene((prev) => (prev + 1) % SCENE_COUNT);
      setProgress(0);
    }, SCENE_MS);

    return () => window.clearInterval(sceneTimer);
  }, []);

  useEffect(() => {
    if (scene !== 2) {
      setProgress(0);
      return;
    }

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const pct = Math.min(((now - start) / (SCENE_MS - 200)) * 100, 100);
      setProgress(pct);
      if (pct < 100) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scene]);

  return (
    <div
      aria-hidden="true"
      className="pd-hero-visual relative mx-auto w-full max-w-lg lg:max-w-none"
    >
      <div
        aria-hidden
        className="absolute -inset-4 rounded-[2rem] bg-pd-brand/15 blur-2xl"
      />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-pd-border bg-pd-surface p-2 shadow-lg sm:p-3">
        <div className="overflow-hidden rounded-[1.25rem] border border-pd-border bg-gradient-to-br from-slate-50 via-white to-indigo-50/80">
          <div className="relative aspect-[16/10] min-h-[220px] w-full sm:min-h-[280px]">
            <Scene active={scene === 0}>
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-rose-500">
                The problem
              </p>
              <div className="relative h-28 w-full max-w-[220px]">
                <div className="absolute left-2 top-0 flex h-14 w-11 -rotate-12 animate-bounce items-center justify-center rounded-lg border border-rose-100 bg-white shadow-md [animation-duration:2s]">
                  <FileText className="h-6 w-6 text-rose-400" />
                </div>
                <div className="absolute left-1/2 top-6 flex h-14 w-11 -translate-x-1/2 rotate-6 items-center justify-center rounded-lg border border-amber-100 bg-white shadow-md">
                  <FileText className="h-6 w-6 text-amber-500" />
                </div>
                <div className="absolute right-2 top-1 flex h-14 w-11 rotate-12 animate-bounce items-center justify-center rounded-lg border border-orange-100 bg-white shadow-md [animation-delay:300ms] [animation-duration:2.2s]">
                  <FileStack className="h-6 w-6 text-orange-500" />
                </div>
              </div>
              <p className="mt-5 text-center text-sm font-semibold text-slate-700">
                Too many PDFs, too many tools
              </p>
            </Scene>

            <Scene active={scene === 1}>
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-pd-brand">
                Step 1 · Upload
              </p>
              <div className="flex w-full max-w-[240px] flex-col items-center rounded-2xl border-2 border-dashed border-pd-brand/50 bg-pd-brand-muted/60 px-5 py-6 shadow-inner">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-md">
                  <Upload className="h-7 w-7 text-pd-brand" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-800">Drop your PDFs here</p>
                <p className="mt-1 text-[11px] text-slate-500">No install · Browser only</p>
              </div>
            </Scene>

            <Scene active={scene === 2}>
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-violet-600">
                Step 2 · One place for every tool
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Layers, label: "Merge", color: "from-blue-500 to-indigo-600" },
                  { icon: Minimize2, label: "Compress", color: "from-violet-500 to-purple-600" },
                  { icon: RefreshCw, label: "Convert", color: "from-emerald-500 to-teal-600" },
                ].map((tool) => (
                  <div
                    key={tool.label}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-white/80 bg-white px-3 py-3 shadow-md"
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tool.color}`}
                    >
                      <tool.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-900">{tool.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-pd-brand to-violet-500 transition-[width] duration-200 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </Scene>

            <Scene active={scene === 3}>
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-emerald-600">
                Done in seconds
              </p>
              <div className="flex flex-col items-center rounded-2xl border border-emerald-100 bg-white px-8 py-6 shadow-lg">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <p className="mt-3 text-base font-bold text-slate-800">Your PDF is ready</p>
                <p className="mt-1 text-xs text-slate-500">Secure · Fast · Free</p>
              </div>
            </Scene>

            <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
              {Array.from({ length: SCENE_COUNT }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    scene === i ? "w-5 bg-pd-brand" : "w-1.5 bg-slate-300"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -left-2 top-8 z-20 hidden whitespace-nowrap rounded-xl border border-pd-border bg-pd-surface px-3 py-2 shadow-lg sm:block">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-pd-success">
          {t("landing.secureLabel")}
        </p>
        <p className="text-xs font-bold text-pd-foreground">{t("landing.secureBadge")}</p>
      </div>
      <div className="absolute -left-2 top-1/2 z-20 hidden -translate-y-1/2 whitespace-nowrap rounded-xl border border-amber-200/80 bg-pd-surface px-3 py-2 shadow-lg sm:block">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          {FILE_SIZE_MARKETING.freeLabel}
        </p>
        <p className="text-xs font-bold text-pd-foreground">{FILE_SIZE_MARKETING.proLabel} on Pro</p>
      </div>
      <div className="absolute -right-2 bottom-16 z-20 hidden whitespace-nowrap rounded-xl border border-pd-border bg-pd-surface px-3 py-2 shadow-lg sm:block">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-pd-brand">
          {t("landing.autoDeleteLabel")}
        </p>
        <p className="text-xs font-bold text-pd-foreground">{t("landing.autoDeleteBadge")}</p>
      </div>
    </div>
  );
}
