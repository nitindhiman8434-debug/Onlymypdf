"use client";

import { cn } from "@/lib/utils/cn";
import {
  DISPLAY_CURRENCIES,
  type DisplayCurrency,
} from "@/lib/pricing/display-currency";

const LABELS: Record<DisplayCurrency, string> = {
  INR: "₹ INR",
  USD: "$ USD",
  EUR: "€ EUR",
};

interface CurrencyToggleProps {
  value: DisplayCurrency;
  onChange: (currency: DisplayCurrency) => void;
  label?: string;
  className?: string;
  variant?: "light" | "dark";
}

export function CurrencyToggle({
  value,
  onChange,
  label,
  className,
  variant = "light",
}: CurrencyToggleProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {label ? (
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            variant === "light" ? "text-pd-muted" : "text-white/60"
          )}
        >
          {label}
        </p>
      ) : null}
      <div
        className={cn(
          "inline-flex items-center rounded-full border p-1 shadow-sm backdrop-blur-sm",
          variant === "light"
            ? "border-pd-border bg-white/90"
            : "border-white/15 bg-white/10"
        )}
        role="group"
        aria-label={label ?? "Display currency"}
      >
        {DISPLAY_CURRENCIES.map((code) => {
          const active = value === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => onChange(code)}
              aria-pressed={active}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-200 sm:px-4 sm:text-sm",
                active
                  ? variant === "light"
                    ? "bg-pd-brand text-white shadow-md shadow-pd-brand/25"
                    : "bg-white text-indigo-900 shadow-lg"
                  : variant === "light"
                    ? "text-pd-muted hover:text-pd-foreground"
                    : "text-white/70 hover:text-white"
              )}
            >
              {LABELS[code]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
