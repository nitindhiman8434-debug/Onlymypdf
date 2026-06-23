import { cn } from "@/lib/utils";
import { Sparkles, ShieldCheck, Gauge } from "lucide-react";

type BadgeKind = "accuracy" | "ai" | "privacy" | "neutral";

const styles: Record<BadgeKind, string> = {
  accuracy: "bg-ai-gradient text-white",
  ai: "bg-violet/10 text-violet ring-1 ring-violet/20",
  privacy: "bg-healing/10 text-healing ring-1 ring-healing/20",
  neutral: "bg-soft text-navy ring-1 ring-slate-200",
};

const icons: Partial<Record<BadgeKind, React.ReactNode>> = {
  accuracy: <Gauge className="h-3.5 w-3.5" />,
  ai: <Sparkles className="h-3.5 w-3.5" />,
  privacy: <ShieldCheck className="h-3.5 w-3.5" />,
};

export function Badge({
  kind = "neutral",
  children,
  className,
}: {
  kind?: BadgeKind;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        styles[kind],
        className
      )}
    >
      {icons[kind]}
      {children}
    </span>
  );
}
