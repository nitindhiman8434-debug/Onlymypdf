"use client";

/**
 * V2 · D2 — Product studio walkthrough (brand-matched).
 * Edit only this file when iterating on the new animation design.
 */

import { useEffect, useState } from "react";
import {
  ArrowRight,
  FileText,
  FileType2,
  Layers,
  Minimize2,
  PenLine,
  Shield,
  Sparkles,
  Timer,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils/cn";

const TOOL_MS = 1000;
const TOOL_COUNT = 5;

const TOOLS = [
  { id: "merge", label: "Merge", icon: Layers },
  { id: "compress", label: "Compress", icon: Minimize2 },
  { id: "convert", label: "Convert", icon: FileType2 },
  { id: "sign", label: "Sign", icon: PenLine },
  { id: "ai", label: "AI PDF", icon: Sparkles },
] as const;

function TrustStrip() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 border-t border-pd-border bg-pd-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold text-pd-foreground">
        <Shield className="h-3.5 w-3.5 shrink-0 text-pd-success" />
        {t("landing.secureLabel")} · {t("landing.secureBadge")}
      </span>
      <span className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold text-pd-foreground">
        <Timer className="h-3.5 w-3.5 shrink-0 text-pd-brand" />
        {t("landing.autoDeleteLabel")} · {t("landing.autoDeleteBadge")}
      </span>
    </div>
  );
}

function MergeDemo({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    setStep(0);
    const t1 = window.setTimeout(() => setStep(1), 350);
    const t2 = window.setTimeout(() => setStep(2), 700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [active]);

  const offsets = step === 0 ? [0, 0, 0] : step === 1 ? [-28, 0, 28] : [0, 0, 0];
  const scales = step === 2 ? [0.7, 0.7, 0.7] : [1, 1, 1];

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <p className="mb-3 text-center text-[11px] font-semibold text-pd-muted">
        Combine multiple PDFs into one file
      </p>
      <div className="relative flex h-28 w-full max-w-[200px] items-center justify-center">
        {["A.pdf", "B.pdf", "C.pdf"].map((name, i) => (
          <div
            key={name}
            className="absolute flex h-16 w-12 flex-col items-center justify-center rounded-lg border border-pd-border bg-white shadow-md transition-all duration-500 ease-out"
            style={{
              transform: `translateX(${offsets[i]}px) scale(${scales[i]})`,
              zIndex: step === 2 ? 1 : 3 - i,
              opacity: step === 2 ? 0 : 1,
            }}
          >
            <FileText className="h-5 w-5 text-pd-brand" />
            <span className="mt-0.5 text-[8px] font-bold text-pd-muted">{name}</span>
          </div>
        ))}
        <div
          className={cn(
            "absolute flex h-20 w-14 flex-col items-center justify-center rounded-xl border-2 border-pd-brand bg-pd-brand-muted shadow-lg transition-all duration-500",
            step === 2 ? "scale-100 opacity-100" : "scale-75 opacity-0"
          )}
        >
          <Layers className="h-6 w-6 text-pd-brand" />
          <span className="mt-1 text-[9px] font-bold text-pd-brand">Merged</span>
        </div>
      </div>
    </div>
  );
}

function CompressDemo({ active }: { active: boolean }) {
  const [size, setSize] = useState(100);

  useEffect(() => {
    if (!active) {
      setSize(100);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / 800, 1);
      setSize(100 - t * 72);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const label = size > 50 ? "4.2 MB" : "890 KB";

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <p className="mb-3 text-center text-[11px] font-semibold text-pd-muted">
        Basic is lossless · Strong makes smaller image-based pages
      </p>
      <div
        className="flex flex-col items-center justify-center rounded-2xl border border-pd-border bg-white shadow-md transition-all duration-200 ease-out"
        style={{
          width: `${56 + (size / 100) * 40}px`,
          height: `${72 + (size / 100) * 36}px`,
        }}
      >
        <FileText className="h-7 w-7 text-pd-brand" />
        <span className="mt-1 text-[10px] font-bold text-pd-foreground">{label}</span>
      </div>
      <div className="mt-4 h-1.5 w-36 overflow-hidden rounded-full bg-pd-border">
        <div
          className="h-full rounded-full bg-pd-brand transition-[width] duration-200"
          style={{ width: `${100 - size}%` }}
        />
      </div>
    </div>
  );
}

function ConvertDemo({ active }: { active: boolean }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) {
      setPhase(0);
      return;
    }
    setPhase(0);
    const t = window.setTimeout(() => setPhase(1), 500);
    return () => window.clearTimeout(t);
  }, [active]);

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <p className="mb-3 text-center text-[11px] font-semibold text-pd-muted">
        Convert Word, Excel, images to PDF
      </p>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-16 w-14 flex-col items-center justify-center rounded-xl border border-pd-border bg-white shadow-md transition-all duration-500",
            phase === 1 ? "scale-90 opacity-40" : "scale-100 opacity-100"
          )}
        >
          <FileType2 className="h-6 w-6 text-indigo-500" />
          <span className="mt-0.5 text-[8px] font-bold text-pd-muted">.docx</span>
        </div>
        <ArrowRight
          className={cn(
            "h-4 w-4 text-pd-brand transition-all duration-500",
            phase === 1 ? "translate-x-1 scale-110" : ""
          )}
        />
        <div
          className={cn(
            "flex h-16 w-14 flex-col items-center justify-center rounded-xl border-2 border-pd-brand bg-pd-brand-muted shadow-md transition-all duration-500",
            phase === 1 ? "scale-100 opacity-100" : "scale-90 opacity-30"
          )}
        >
          <FileText className="h-6 w-6 text-pd-brand" />
          <span className="mt-0.5 text-[8px] font-bold text-pd-brand">.pdf</span>
        </div>
      </div>
    </div>
  );
}

function SignDemo({ active }: { active: boolean }) {
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    if (!active) {
      setDrawn(0);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / 700, 1);
      setDrawn(t * 100);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <p className="mb-3 text-center text-[11px] font-semibold text-pd-muted">
        Sign contracts directly in your browser
      </p>
      <div className="w-full max-w-[180px] rounded-xl border border-pd-border bg-white p-3 shadow-md">
        <div className="h-16 rounded-lg bg-pd-background" />
        <div className="relative mt-2 h-8 border-b border-dashed border-pd-border">
          <svg className="absolute bottom-0 left-0 h-7 w-full overflow-visible" viewBox="0 0 120 28">
            <path
              d="M 4 20 Q 30 4, 55 18 T 110 12"
              fill="none"
              stroke="var(--pd-brand)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="140"
              strokeDashoffset={140 - (drawn / 100) * 140}
            />
          </svg>
        </div>
        <p className="mt-1 text-[9px] text-pd-muted">Signature added</p>
      </div>
    </div>
  );
}

function AiDemo({ active }: { active: boolean }) {
  const [lines, setLines] = useState(0);

  useEffect(() => {
    if (!active) {
      setLines(0);
      return;
    }
    setLines(0);
    const timers = [1, 2, 3].map((n, i) =>
      window.setTimeout(() => setLines(n), 250 + i * 220)
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [active]);

  const bullets = ["Key findings extracted", "Action items listed", "Summary ready"];

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <p className="mb-3 text-center text-[11px] font-semibold text-pd-muted">
        AI reads long PDFs and gives instant summaries
      </p>
      <div className="flex w-full max-w-[200px] gap-2">
        <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg border border-pd-border bg-white shadow-sm">
          <FileText className="h-6 w-6 text-pd-brand" />
        </div>
        <div className="flex-1 rounded-lg border border-violet-200 bg-violet-50 p-2">
          <div className="mb-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-violet-600" />
            <span className="text-[9px] font-bold text-violet-700">AI Summary</span>
          </div>
          <ul className="space-y-1">
            {bullets.map((text, i) => (
              <li
                key={text}
                className={cn(
                  "flex items-start gap-1 text-[8px] text-violet-800 transition-all duration-300",
                  i < lines ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0"
                )}
              >
                <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-violet-500" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const DEMOS = [MergeDemo, CompressDemo, ConvertDemo, SignDemo, AiDemo];

export function HeroVisualV2D2() {
  const [activeTool, setActiveTool] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveTool((prev) => (prev + 1) % TOOL_COUNT);
    }, TOOL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const ActiveDemo = DEMOS[activeTool];

  return (
    <div className="pd-hero-visual relative mx-auto w-full max-w-lg lg:max-w-none">
      <div aria-hidden className="absolute -inset-4 rounded-[2rem] bg-pd-brand/15 blur-2xl" />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-pd-border bg-pd-surface p-2 shadow-lg sm:p-3">
        <div className="overflow-hidden rounded-[1.25rem] border border-pd-border bg-pd-surface">
          {/* App header */}
          <div className="flex items-center gap-2 border-b border-pd-border bg-pd-brand px-3 py-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">OnlyMyPDF</p>
              <p className="truncate text-[9px] text-white/75">Free · Browser · No install</p>
            </div>
          </div>

          {/* Tool tabs */}
          <div className="flex gap-0.5 overflow-x-auto border-b border-pd-border bg-pd-background px-2 py-1.5 scrollbar-hide">
            {TOOLS.map((tool, i) => {
              const Icon = tool.icon;
              const isActive = activeTool === i;
              return (
                <span
                  key={tool.id}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-semibold transition-all duration-300",
                    isActive
                      ? "bg-pd-brand text-white shadow-sm"
                      : "text-pd-muted"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {tool.label}
                </span>
              );
            })}
          </div>

          {/* Demo stage */}
          <div className="relative aspect-[16/10] min-h-[200px] w-full bg-gradient-to-b from-pd-brand-muted/40 to-pd-surface sm:min-h-[260px]">
            <ActiveDemo active key={activeTool} />
          </div>

          <TrustStrip />

          {/* Progress */}
          <div className="flex justify-center gap-1 bg-pd-background py-2">
            {TOOLS.map((tool, i) => (
              <span
                key={tool.id}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  activeTool === i ? "w-5 bg-pd-brand" : "w-1 bg-pd-border"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
