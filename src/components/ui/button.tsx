"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-pd-brand text-white hover:bg-pd-brand-hover focus-visible:ring-pd-brand shadow-sm",
        secondary:
          "bg-pd-surface text-pd-foreground border border-pd-border hover:bg-pd-background focus-visible:ring-pd-brand",
        outline:
          "border-2 border-pd-border bg-pd-surface text-pd-foreground hover:border-pd-border-strong hover:bg-pd-background focus-visible:ring-pd-brand",
        ghost:
          "text-pd-foreground hover:bg-pd-brand-muted hover:text-pd-brand focus-visible:ring-pd-brand",
        link: "text-pd-brand underline-offset-4 hover:underline focus-visible:ring-pd-brand p-0 h-auto font-medium",
        destructive:
          "bg-pd-danger text-white hover:bg-red-700 focus-visible:ring-pd-danger shadow-sm",
        gradient:
          "bg-gradient-to-r from-pd-brand to-violet-600 text-white hover:opacity-95 focus-visible:ring-pd-brand shadow-sm",
      },
      size: {
        sm: "h-9 min-h-9 px-4 text-sm rounded-[var(--pd-btn-radius)]",
        md: "h-11 min-h-11 px-6 text-[15px] rounded-[var(--pd-btn-radius)]",
        lg: "h-[52px] min-h-[52px] px-8 text-base rounded-[var(--pd-btn-radius)]",
        icon: "h-11 w-11 min-h-11 min-w-11 rounded-[var(--pd-btn-radius)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
